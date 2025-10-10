// Base type
export interface MessageContent {
  content: string;
  type: 'plain' | 'link' | 'image';
  $type: 'plain' | 'link' | 'image';
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

export type MessageContentUnion = PlainTextContent | LinkContent | ImageContent;
