export interface Account {
  id: string;
  userName: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  countryCode: string;
  isVerified: boolean;
  /** Base64 SPKI public key for E2E encryption */
  publicKey?: string;
}
