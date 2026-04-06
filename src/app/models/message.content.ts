// Base type
export interface MessageContent {
  content: string;
  type: 'plain' | 'link' | 'attachment';
  $type: 'plain' | 'link' | 'attachment';
}

export interface PlainTextContent extends MessageContent {
  type: 'plain';
}

export interface LinkContent extends MessageContent {
  type: 'link';
}

export interface AttachmentContent extends MessageContent {
  type: 'attachment';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export type MessageContentUnion =
  | PlainTextContent
  | LinkContent
  | AttachmentContent;
