/**
 * Key pair for ECDH encryption
 */
export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

/**
 * Recipient information needed for encryption
 */
export interface RecipientPublicKey {
  recipientId: string;
  publicKey: string; // Base64 SPKI format
}

/**
 * Result of encryption operation
 */
export interface EncryptionResult {
  encryptedContent: string;
  iv: string;
  encryptedKeys: { [recipientId: string]: string };
}
