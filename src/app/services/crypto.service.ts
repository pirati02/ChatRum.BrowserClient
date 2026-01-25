import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';
import { KeyPair, RecipientPublicKey, EncryptionResult } from '../models/encrypted-message';

const KEY_STORAGE_PREFIX = 'e2e-keypair-';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  /**
   * Generate a new ECDH key pair for encryption
   */
  async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable - needed for export
      ['deriveKey', 'deriveBits']
    );

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  /**
   * Export public key to Base64 SPKI format for sending to server
   */
  async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    return this.arrayBufferToBase64(exported);
  }

  /**
   * Import a public key from Base64 SPKI format
   */
  async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    );
  }

  /**
   * Store key pair in IndexedDB for persistence
   */
  async storeKeyPair(userId: string, keyPair: KeyPair): Promise<void> {
    // Export keys to storable format
    const exportedPublic = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const exportedPrivate = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const storableKeyPair = {
      publicKey: this.arrayBufferToBase64(exportedPublic),
      privateKey: this.arrayBufferToBase64(exportedPrivate)
    };

    await set(KEY_STORAGE_PREFIX + userId, storableKeyPair);
  }

  /**
   * Retrieve key pair from IndexedDB
   */
  async getKeyPair(userId: string): Promise<KeyPair | null> {
    const stored = await get<{ publicKey: string; privateKey: string }>(KEY_STORAGE_PREFIX + userId);

    if (!stored) {
      return null;
    }

    try {
      const publicKey = await crypto.subtle.importKey(
        'spki',
        this.base64ToArrayBuffer(stored.publicKey),
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );

      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        this.base64ToArrayBuffer(stored.privateKey),
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        ['deriveKey', 'deriveBits']
      );

      return { publicKey, privateKey };
    } catch (error) {
      console.error('Failed to import stored key pair:', error);
      return null;
    }
  }

  /**
   * Delete key pair from IndexedDB (e.g., on logout)
   */
  async deleteKeyPair(userId: string): Promise<void> {
    await del(KEY_STORAGE_PREFIX + userId);
  }

  /**
   * Encrypt a message for multiple recipients
   */
  async encryptMessage(
    message: string,
    recipients: RecipientPublicKey[],
    senderKeyPair: KeyPair
  ): Promise<EncryptionResult> {
    // Generate random AES-256-GCM session key
    const aesKey = await crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true, // extractable for wrapping
      ['encrypt', 'decrypt']
    );

    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt message content with AES-GCM
    const encoder = new TextEncoder();
    const messageData = encoder.encode(message);

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      messageData
    );

    // Export AES key for wrapping
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);

    // Encrypt AES key for each recipient using ECDH
    const encryptedKeys: { [recipientId: string]: string } = {};

    for (const recipient of recipients) {
      try {
        const recipientPublicKey = await this.importPublicKey(recipient.publicKey);
        const wrappedKey = await this.wrapKeyForRecipient(
          rawAesKey,
          senderKeyPair.privateKey,
          recipientPublicKey
        );
        encryptedKeys[recipient.recipientId] = this.arrayBufferToBase64(wrappedKey);
      } catch (error) {
        console.error(`Failed to encrypt key for recipient ${recipient.recipientId}:`, error);
      }
    }

    return {
      encryptedContent: this.arrayBufferToBase64(encryptedContent),
      iv: this.arrayBufferToBase64(iv),
      encryptedKeys
    };
  }

  /**
   * Decrypt a message received from a sender
   */
  async decryptMessage(
    encryptedContent: string,
    iv: string,
    encryptedAesKey: string,
    senderPublicKey: string,
    recipientKeyPair: KeyPair
  ): Promise<string> {
    // Import sender's public key
    const senderKey = await this.importPublicKey(senderPublicKey);

    // Unwrap the AES key
    const unwrappedAesKey = await this.unwrapKeyFromSender(
      this.base64ToArrayBuffer(encryptedAesKey),
      recipientKeyPair.privateKey,
      senderKey
    );

    // Decrypt the message content
    const decryptedContent = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: this.base64ToArrayBuffer(iv)
      },
      unwrappedAesKey,
      this.base64ToArrayBuffer(encryptedContent)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedContent);
  }

  /**
   * Check if IndexedDB is available (may not be in private browsing)
   */
  async isStorageAvailable(): Promise<boolean> {
    try {
      await set('__test__', 'test');
      await del('__test__');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wrap AES key for a recipient using ECDH derived shared secret
   */
  private async wrapKeyForRecipient(
    rawAesKey: ArrayBuffer,
    senderPrivateKey: CryptoKey,
    recipientPublicKey: CryptoKey
  ): Promise<ArrayBuffer> {
    // Derive shared secret using ECDH
    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: recipientPublicKey
      },
      senderPrivateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );

    // Use a fixed IV for key wrapping (key wrapping is deterministic)
    const wrapIv = new Uint8Array(12); // All zeros for key wrapping

    // Encrypt the AES key with the derived shared key
    return crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: wrapIv
      },
      sharedKey,
      rawAesKey
    );
  }

  /**
   * Unwrap AES key from sender using ECDH derived shared secret
   */
  private async unwrapKeyFromSender(
    wrappedKey: ArrayBuffer,
    recipientPrivateKey: CryptoKey,
    senderPublicKey: CryptoKey
  ): Promise<CryptoKey> {
    // Derive shared secret using ECDH
    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: senderPublicKey
      },
      recipientPrivateKey,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );

    // Use a fixed IV for key unwrapping
    const wrapIv = new Uint8Array(12);

    // Decrypt the wrapped AES key
    const unwrappedKeyData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: wrapIv
      },
      sharedKey,
      wrappedKey
    );

    // Import the unwrapped key as AES-GCM key
    return crypto.subtle.importKey(
      'raw',
      unwrappedKeyData,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
