import { Injectable } from '@angular/core';
import { get, set, del } from 'idb-keyval';
import { KeyPair, RecipientPublicKey, EncryptionResult } from '../models/encrypted-message';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, catchError, concatMap, reduce } from 'rxjs/operators';

const KEY_STORAGE_PREFIX = 'e2e-keypair-';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  /**
   * Generate a new ECDH key pair for encryption
   */
  generateKeyPair(): Observable<KeyPair> {
    return from(crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable - needed for export
      ['deriveKey', 'deriveBits']
    )).pipe(
      map(keyPair => ({
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey
      }))
    );
  }

  /**
   * Export public key to Base64 SPKI format for sending to server
   */
  exportPublicKey(publicKey: CryptoKey): Observable<string> {
    return from(crypto.subtle.exportKey('spki', publicKey)).pipe(
      map(exported => this.arrayBufferToBase64(exported))
    );
  }

  /**
   * Import a public key from Base64 SPKI format
   */
  importPublicKey(base64Key: string): Observable<CryptoKey> {
    const keyData = this.base64ToArrayBuffer(base64Key);
    return from(crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      []
    ));
  }

  /**
   * Store key pair in IndexedDB for persistence
   */
  storeKeyPair(userId: string, keyPair: KeyPair): Observable<void> {
    return from(Promise.all([
      crypto.subtle.exportKey('spki', keyPair.publicKey),
      crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
    ])).pipe(
      switchMap(([exportedPublic, exportedPrivate]) => {
        const storableKeyPair = {
          publicKey: this.arrayBufferToBase64(exportedPublic),
          privateKey: this.arrayBufferToBase64(exportedPrivate)
        };
        return from(set(KEY_STORAGE_PREFIX + userId, storableKeyPair));
      })
    );
  }

  /**
   * Retrieve key pair from IndexedDB
   */
  getKeyPair(userId: string): Observable<KeyPair | null> {
    return from(get<{ publicKey: string; privateKey: string }>(KEY_STORAGE_PREFIX + userId)).pipe(
      switchMap(stored => {
        if (!stored) {
          return of(null);
        }

        return from(Promise.all([
          crypto.subtle.importKey(
            'spki',
            this.base64ToArrayBuffer(stored.publicKey),
            {
              name: 'ECDH',
              namedCurve: 'P-256'
            },
            true,
            []
          ),
          crypto.subtle.importKey(
            'pkcs8',
            this.base64ToArrayBuffer(stored.privateKey),
            {
              name: 'ECDH',
              namedCurve: 'P-256'
            },
            true,
            ['deriveKey', 'deriveBits']
          )
        ])).pipe(
          map(([publicKey, privateKey]) => ({ publicKey, privateKey })),
          catchError(error => {
            console.error('Failed to import stored key pair:', error);
            return of(null);
          })
        );
      })
    );
  }

  /**
   * Delete key pair from IndexedDB (e.g., on logout)
   */
  deleteKeyPair(userId: string): Observable<void> {
    return from(del(KEY_STORAGE_PREFIX + userId));
  }

  /**
   * Encrypt a message for multiple recipients
   */
  encryptMessage(
    message: string,
    recipients: RecipientPublicKey[],
    senderKeyPair: KeyPair
  ): Observable<EncryptionResult> {
    return from(crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    )).pipe(
      switchMap(aesKey => {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const messageData = encoder.encode(message);

        return from(Promise.all([
          crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, aesKey, messageData),
          crypto.subtle.exportKey('raw', aesKey)
        ])).pipe(
          switchMap(([encryptedContent, rawAesKey]) => {
            return this.encryptKeysForRecipients(recipients, rawAesKey, senderKeyPair).pipe(
              map(encryptedKeys => ({
                encryptedContent: this.arrayBufferToBase64(encryptedContent),
                iv: this.arrayBufferToBase64(iv),
                encryptedKeys
              }))
            );
          })
        );
      })
    );
  }

  /**
   * Decrypt a message received from a sender
   */
  decryptMessage(
    encryptedContent: string,
    iv: string,
    encryptedAesKey: string,
    senderPublicKey: string,
    recipientKeyPair: KeyPair
  ): Observable<string> {
    return this.importPublicKey(senderPublicKey).pipe(
      switchMap(senderKey =>
        from(this.unwrapKeyFromSender(
          this.base64ToArrayBuffer(encryptedAesKey),
          recipientKeyPair.privateKey,
          senderKey
        ))
      ),
      switchMap(unwrappedAesKey =>
        from(crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: this.base64ToArrayBuffer(iv)
          },
          unwrappedAesKey,
          this.base64ToArrayBuffer(encryptedContent)
        ))
      ),
      map(decryptedContent => {
        const decoder = new TextDecoder();
        return decoder.decode(decryptedContent);
      })
    );
  }

  /**
   * Check if IndexedDB is available (may not be in private browsing)
   */
  isStorageAvailable(): Observable<boolean> {
    return from(set('__test__', 'test')).pipe(
      switchMap(() => from(del('__test__'))),
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Encrypt AES keys for all recipients
   */
  private encryptKeysForRecipients(
    recipients: RecipientPublicKey[],
    rawAesKey: ArrayBuffer,
    senderKeyPair: KeyPair
  ): Observable<{ [recipientId: string]: string }> {
    if (recipients.length === 0) {
      return of({});
    }

    return from(recipients).pipe(
      concatMap(recipient =>
        this.importPublicKey(recipient.publicKey).pipe(
          switchMap(recipientPublicKey =>
            from(this.wrapKeyForRecipient(rawAesKey, senderKeyPair.privateKey, recipientPublicKey))
          ),
          map(wrappedKey => ({
            recipientId: recipient.recipientId,
            encryptedKey: this.arrayBufferToBase64(wrappedKey)
          })),
          catchError(error => {
            console.error(`Failed to encrypt key for recipient ${recipient.recipientId}:`, error);
            return of(null);
          })
        )
      ),
      reduce((acc, result) => {
        if (result) {
          acc[result.recipientId] = result.encryptedKey;
        }
        return acc;
      }, {} as { [recipientId: string]: string })
    );
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
