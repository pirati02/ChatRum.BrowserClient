// Base type
export interface MessageContent {
  content: string;
  type: 'plain' | 'link' | 'image' | 'encrypted';
  $type: 'plain' | 'link' | 'image' | 'encrypted';
}

export interface PlainTextContent extends MessageContent {
  type: 'plain';
}

export interface LinkContent extends MessageContent {
  type: 'link';
}

export interface ImageContent extends MessageContent {
  type: 'image';
}

export interface EncryptedContent extends MessageContent {
  type: 'encrypted';
  $type: 'encrypted';
  /** Base64 encoded initialization vector for AES-GCM */
  iv: string;
  /** Map of recipient ID to their Base64 encoded encrypted AES key */
  encryptedKeys: { [recipientId: string]: string };
}

export type MessageContentUnion = PlainTextContent | LinkContent | ImageContent | EncryptedContent;
