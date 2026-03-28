import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { JwtDisplayClaims, LoginResponse } from './auth.types';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    @Inject('ACCOUNTS_BASE_URL') private accountsBaseUrl: string,
    private http: HttpClient,
    private session: AuthSessionService,
  ) {}

  async login(
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<LoginResponse> {
    const url = `${this.accountsBaseUrl}/login`;
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(url, { email, password }),
    );
    if (!res?.access_token) {
      throw new Error('Invalid login response');
    }
    this.session.persistSession(res, rememberMe);
    return res;
  }

  logout(): void {
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
}
