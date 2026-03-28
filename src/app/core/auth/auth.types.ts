export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token: string;
  refresh_expires_in?: number;
}

export interface JwtDisplayClaims {
  sub?: string;
  email?: string;
  unique_name?: string;
}
