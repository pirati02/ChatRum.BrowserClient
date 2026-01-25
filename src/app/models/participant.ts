export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  nickName: string;
  isAdmin: boolean;
  /** Base64 SPKI public key for E2E encryption */
  publicKey?: string;
}
