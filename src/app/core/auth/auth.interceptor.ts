import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { GATEWAY_URL } from './gateway.token';

function isAnonymousRequest(method: string, pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || pathname;
  if (method === 'GET' && p.endsWith('/health')) {
    return true;
  }
  if (
    method === 'POST' &&
    (p === '/account/login' || p === '/api/account/login')
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
      if (
        err instanceof HttpErrorResponse &&
        (err.status === 401 || err.status === 403)
      ) {
        let pathname = '';
        try {
          pathname = new URL(req.url).pathname;
        } catch {
          return throwError(() => err);
        }
        if (pathname && !isAnonymousRequest(req.method, pathname)) {
          session.clear();
          void router.navigate(['/login'], {
            queryParams: { returnUrl: router.url },
          });
        }
      }
      return throwError(() => err);
    }),
  );
};
