import { Injectable } from '@angular/core';
import { JwtDisplayClaims, LoginResponse } from './auth.types';

const STORAGE_TOKEN = 'chatrum_access_token';
const STORAGE_EXPIRES = 'chatrum_token_expires_at';
const STORAGE_REFRESH = 'chatrum_refresh_token';
const STORAGE_REFRESH_EXPIRES = 'chatrum_refresh_expires_at';
const STORAGE_REMEMBER = 'chatrum_remember_me';

/** Refresh tokens in web storage are vulnerable to XSS; prefer httpOnly cookies + BFF when possible. */
function removeTokenKeysFromBoth(): void {
  for (const storage of [sessionStorage, localStorage]) {
    storage.removeItem(STORAGE_TOKEN);
    storage.removeItem(STORAGE_EXPIRES);
    storage.removeItem(STORAGE_REFRESH);
    storage.removeItem(STORAGE_REFRESH_EXPIRES);
  }
}

function readRememberMe(): boolean {
  return localStorage.getItem(STORAGE_REMEMBER) === '1';
}

/**
 * Token persistence only (no HttpClient). Used by AuthService and HTTP interceptor
 * to avoid HttpClient ↔ AuthService circular dependency.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  clear(): void {
    removeTokenKeysFromBoth();
    localStorage.removeItem(STORAGE_REMEMBER);
  }

  getAccessToken(): string | null {
    return (
      localStorage.getItem(STORAGE_TOKEN) ??
      sessionStorage.getItem(STORAGE_TOKEN)
    );
  }

  /** For refresh / auth layer only — never attach to arbitrary requests. */
  getRefreshToken(): string | null {
    return (
      localStorage.getItem(STORAGE_REFRESH) ??
      sessionStorage.getItem(STORAGE_REFRESH)
    );
  }

  isAuthenticated(): boolean {
    const refresh = this.getRefreshToken();
    const refreshExpRaw =
      localStorage.getItem(STORAGE_REFRESH_EXPIRES) ??
      sessionStorage.getItem(STORAGE_REFRESH_EXPIRES);
    if (refresh && refreshExpRaw) {
      const rt = Number(refreshExpRaw);
      if (!Number.isNaN(rt) && Date.now() >= rt) {
        this.clear();
        return false;
      }
    }

    const token = this.getAccessToken();
    if (!token) {
      return !!(refresh && refreshExpRaw && Date.now() < Number(refreshExpRaw));
    }

    const accessExpRaw =
      (localStorage.getItem(STORAGE_TOKEN)
        ? localStorage.getItem(STORAGE_EXPIRES)
        : sessionStorage.getItem(STORAGE_EXPIRES)) ?? null;
    if (accessExpRaw) {
      const t = Number(accessExpRaw);
      if (!Number.isNaN(t) && Date.now() >= t) {
        if (
          refresh &&
          refreshExpRaw &&
          !Number.isNaN(Number(refreshExpRaw)) &&
          Date.now() < Number(refreshExpRaw)
        ) {
          return true;
        }
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
    this.writeTokensToStore(store, res);
  }

  /** After POST /account/refresh; keeps remember-me storage choice. */
  replaceTokens(res: LoginResponse): void {
    removeTokenKeysFromBoth();
    const store = readRememberMe() ? localStorage : sessionStorage;
    this.writeTokensToStore(store, res);
  }

  private writeTokensToStore(store: Storage, res: LoginResponse): void {
    store.setItem(STORAGE_TOKEN, res.access_token);
    store.setItem(STORAGE_REFRESH, res.refresh_token);
    if (res.expires_in != null && res.expires_in > 0) {
      store.setItem(
        STORAGE_EXPIRES,
        String(Date.now() + res.expires_in * 1000),
      );
    } else {
      store.removeItem(STORAGE_EXPIRES);
    }
    if (res.refresh_expires_in != null && res.refresh_expires_in > 0) {
      store.setItem(
        STORAGE_REFRESH_EXPIRES,
        String(Date.now() + res.refresh_expires_in * 1000),
      );
    } else {
      store.removeItem(STORAGE_REFRESH_EXPIRES);
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
