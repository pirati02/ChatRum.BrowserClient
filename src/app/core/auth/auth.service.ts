import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { JwtDisplayClaims, LoginResponse } from './auth.types';

const PROACTIVE_REFRESH_SKEW_MS = 60_000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly rawHttp: HttpClient;
  private proactiveRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject('ACCOUNTS_BASE_URL') private accountsBaseUrl: string,
    private http: HttpClient,
    backend: HttpBackend,
    private session: AuthSessionService,
  ) {
    this.rawHttp = new HttpClient(backend);
  }

  async login(
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<LoginResponse> {
    const url = `${this.accountsBaseUrl}/login`;
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password }),
    );
    if (!res?.access_token || !res?.refresh_token) {
      throw new Error('Invalid login response');
    }
    this.session.persistSession(res, rememberMe);
    this.scheduleProactiveRefresh(res);
    return res;
  }

  /**
   * POST /account/refresh via HttpBackend (bypasses auth interceptor).
   * Returns null if session cleared (401/400); throws on other errors.
   */
  async refreshTokens(): Promise<LoginResponse | null> {
    const refresh = this.session.getRefreshToken();
    if (!refresh) {
      this.invalidateSession();
      return null;
    }
    const url = `${this.accountsBaseUrl}/refresh`;
    try {
      const res = await firstValueFrom(
        this.rawHttp.post<LoginResponse>(url, { refresh_token: refresh }),
      );
      if (!res?.access_token || !res?.refresh_token) {
        this.invalidateSession();
        return null;
      }
      this.session.replaceTokens(res);
      this.scheduleProactiveRefresh(res);
      return res;
    } catch (e) {
      if (
        e instanceof HttpErrorResponse &&
        (e.status === 401 || e.status === 400)
      ) {
        this.invalidateSession();
        return null;
      }
      throw e;
    }
  }

  logout(): void {
    this.invalidateSession();
  }

  /** Clear tokens and cancel proactive refresh; does not navigate. */
  invalidateSession(): void {
    this.cancelProactiveRefresh();
    this.session.clear();
  }

  getAccessToken(): string | null {
    return this.session.getAccessToken();
  }

  isAuthenticated(): boolean {
    return this.session.isAuthenticated();
  }

  getJwtClaims(): JwtDisplayClaims | null {
    return this.session.getJwtClaims();
  }

  private cancelProactiveRefresh(): void {
    if (this.proactiveRefreshTimeoutId != null) {
      clearTimeout(this.proactiveRefreshTimeoutId);
      this.proactiveRefreshTimeoutId = null;
    }
  }

  private scheduleProactiveRefresh(res: LoginResponse): void {
    this.cancelProactiveRefresh();
    if (res.expires_in == null || res.expires_in <= 0) {
      return;
    }
    const delayMs = Math.max(
      0,
      res.expires_in * 1000 - PROACTIVE_REFRESH_SKEW_MS,
    );
    this.proactiveRefreshTimeoutId = setTimeout(() => {
      this.proactiveRefreshTimeoutId = null;
      void this.refreshTokens().catch(() => {
        /* network errors: next API 401 will retry refresh */
      });
    }, delayMs);
  }
}
