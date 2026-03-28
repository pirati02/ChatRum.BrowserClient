import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { GATEWAY_URL } from './gateway.token';

/** Set on the retried request after a successful token refresh (retry once). */
const AUTH_RETRY_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

let refreshInFlight: Promise<boolean> | null = null;

function ensureRefreshed(auth: AuthService): Promise<boolean> {
  if (!refreshInFlight) {
    const p = auth
      .refreshTokens()
      .then((r) => !!r)
      .catch(() => false);
    refreshInFlight = p.finally(() => {
      if (refreshInFlight === p) {
        refreshInFlight = null;
      }
    });
  }
  return refreshInFlight;
}

function isAnonymousRequest(method: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || pathname;
  if (method === 'GET' && p.endsWith('/health')) {
    return true;
  }
  if (
    method === 'POST' &&
    (p === '/account/login' ||
      p === '/account/refresh' ||
      p === '/api/account/login' ||
      p === '/api/account/refresh')
  ) {
    return true;
  }
  if (method === 'POST' && (p === '/account' || p === '/api/account')) {
    return true;
  }
  if (
    method === 'PUT' &&
    (p === '/account/activate' || p === '/api/account/activate')
  ) {
    return true;
  }
  if (method === 'PATCH') {
    if (
      /\/account\/[^/]+\/resend-code$/.test(p) ||
      /\/api\/account\/[^/]+\/resend-code$/.test(p)
    ) {
      return true;
    }
  }
  return false;
}

function isGatewayRequest(reqUrl: string, gatewayUrl: string): boolean {
  const base = gatewayUrl.replace(/\/$/, '');
  return reqUrl.startsWith(base);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const gatewayUrl = inject(GATEWAY_URL);
  const session = inject(AuthSessionService);
  const auth = inject(AuthService);
  const router = inject(Router);

  let outgoing = req;
  if (isGatewayRequest(req.url, gatewayUrl)) {
    let pathname = '';
    try {
      pathname = new URL(req.url).pathname;
    } catch {
      return next(req);
    }
    if (
      pathname &&
      !isAnonymousRequest(req.method, pathname) &&
      session.isAuthenticated()
    ) {
      const token = session.getAccessToken();
      if (token) {
        outgoing = req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        });
      }
    }
  }

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }

      let pathname = '';
      try {
        pathname = new URL(req.url).pathname;
      } catch {
        return throwError(() => err);
      }

      if (
        !pathname ||
        !isGatewayRequest(req.url, gatewayUrl) ||
        isAnonymousRequest(req.method, pathname)
      ) {
        return throwError(() => err);
      }

      if (err.status === 403) {
        auth.invalidateSession();
        void router.navigate(['/login'], {
          queryParams: { returnUrl: router.url },
        });
        return throwError(() => err);
      }

      if (err.status !== 401) {
        return throwError(() => err);
      }

      if (req.context.get(AUTH_RETRY_AFTER_REFRESH)) {
        auth.invalidateSession();
        void router.navigate(['/login'], {
          queryParams: { returnUrl: router.url },
        });
        return throwError(() => err);
      }

      if (!session.getRefreshToken()) {
        auth.invalidateSession();
        void router.navigate(['/login'], {
          queryParams: { returnUrl: router.url },
        });
        return throwError(() => err);
      }

      return from(ensureRefreshed(auth)).pipe(
        switchMap((ok) => {
          if (!ok) {
            if (session.isAuthenticated() && session.getRefreshToken()) {
              return throwError(() => err);
            }
            void router.navigate(['/login'], {
              queryParams: { returnUrl: router.url },
            });
            return throwError(() => err);
          }
          const token = session.getAccessToken();
          if (!token) {
            void router.navigate(['/login'], {
              queryParams: { returnUrl: router.url },
            });
            return throwError(() => err);
          }
          const retry = req.clone({
            setHeaders: { Authorization: `Bearer ${token}` },
            context: req.context.set(AUTH_RETRY_AFTER_REFRESH, true),
          });
          return next(retry);
        }),
      );
    }),
  );
};
