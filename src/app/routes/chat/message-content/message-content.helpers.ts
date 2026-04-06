import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AttachmentContent, MessageContent } from '../../../models/message.content';

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif',
]);

export function getDisplayKind(content: MessageContent | null | undefined): string {
  const raw = content?.$type || content?.type;
  if (typeof raw !== 'string') {
    return 'plain';
  }

  return raw.toLowerCase();
}

export function getAttachment(
  content: MessageContent | null | undefined,
  displayKind: string,
): AttachmentContent | null {
  if (displayKind !== 'attachment') {
    return null;
  }

  return content as AttachmentContent;
}

export function isImageAttachment(attachment: AttachmentContent | null): boolean {
  return !!attachment?.mimeType?.startsWith('image/');
}

export function tryGetImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const candidate = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const path = parsed.pathname.toLowerCase();
  for (const extension of IMAGE_EXTENSIONS) {
    if (path.endsWith(extension)) {
      return parsed.toString();
    }
  }

  return null;
}

export function resolveUrl(value: unknown, gatewayBase: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }

  const candidate = value.trim();
  const normalized = candidate.startsWith('/api/chat/')
    ? `/chat/${candidate.slice('/api/chat/'.length)}`
    : candidate;
  try {
    return new URL(normalized).toString();
  } catch {
    if (normalized.startsWith('/')) {
      return `${gatewayBase}${normalized}`;
    }
    return `${gatewayBase}/${normalized}`;
  }
}

export function withAccessToken(url: string, accessToken: string | null): string {
  if (!url) {
    return '';
  }

  if (!accessToken) {
    return url;
  }

  try {
    const u = new URL(url);
    if (!u.searchParams.has('access_token')) {
      u.searchParams.set('access_token', accessToken);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function revokeAttachmentImageUrl(currentUrl: string | null): string | null {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
  }

  return null;
}

export function loadAttachmentImage(
  http: HttpClient,
  attachment: AttachmentContent | null,
  imageAttachment: boolean,
  attachmentUrl: string,
  accessToken: string | null,
  onLoaded: (blob: Blob) => void,
  onError: () => void,
): Subscription | undefined {
  if (!attachment || !imageAttachment || !attachmentUrl) {
    return undefined;
  }

  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;

  return http.get(attachmentUrl, { responseType: 'blob', headers }).subscribe({
    next: onLoaded,
    error: onError,
  });
}
