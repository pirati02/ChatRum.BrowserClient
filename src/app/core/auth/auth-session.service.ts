import { Injectable } from '@angular/core';
import { JwtDisplayClaims, LoginResponse } from './auth.types';

const STORAGE_TOKEN = 'chatrum_access_token';
const STORAGE_EXPIRES = 'chatrum_token_expires_at';
const STORAGE_REMEMBER = 'chatrum_remember_me';

/**
 * Token persistence only (no HttpClient). Used by AuthService and HTTP interceptor
 * to avoid HttpClient ↔ AuthService circular dependency.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  clear(): void {
    sessionStorage.removeItem(STORAGE_TOKEN);
    sessionStorage.removeItem(STORAGE_EXPIRES);
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_EXPIRES);
    localStorage.removeItem(STORAGE_REMEMBER);
  }

  getAccessToken(): string | null {
    return (
      localStorage.getItem(STORAGE_TOKEN) ??
      sessionStorage.getItem(STORAGE_TOKEN)
    );
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }
    const exp =
      (localStorage.getItem(STORAGE_TOKEN)
        ? localStorage.getItem(STORAGE_EXPIRES)
        : sessionStorage.getItem(STORAGE_EXPIRES)) ?? null;
    if (exp) {
      const t = Number(exp);
      if (!Number.isNaN(t) && Date.now() >= t) {
        this.clear();
        return false;
      }
    }
    return true;
  }

  persistSession(res: LoginResponse, rememberMe: boolean): void {
    this.clear();
    localStorage.setItem(STORAGE_REMEMBER, rememberMe ? '1' : '0');
    const store: Storage = rememberMe ? localStorage : sessionStorage;
    store.setItem(STORAGE_TOKEN, res.access_token);
    if (res.expires_in != null && res.expires_in > 0) {
      store.setItem(
        STORAGE_EXPIRES,
        String(Date.now() + res.expires_in * 1000),
      );
    }
  }

  getJwtClaims(): JwtDisplayClaims | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return null;
      }
      const payload = parts[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as JwtDisplayClaims;
    } catch {
      return null;
    }
  }
}
