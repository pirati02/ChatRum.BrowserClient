import { MessageContentUnion } from './message.content';

/** Discriminator fields the API / SignalR may use (camelCase, PascalCase, System.Text.Json $type). */
const DISCRIMINATOR_KEYS = ['$type', 'type', 'Type', '$Type'] as const;

function readDiscriminator(raw: Record<string, unknown>): string {
  for (const key of DISCRIMINATOR_KEYS) {
    const v = raw[key];
    if (typeof v === 'string' && v.length > 0) {
      return v;
    }
  }
  return '';
}

/**
 * Maps API polymorphic names to plain | link | attachment, or legacy for blobs we cannot render as text.
 */
function resolveKind(
  discriminator: string,
): 'plain' | 'link' | 'attachment' | 'legacy' | null {
  const d = discriminator.trim().toLowerCase();
  const leaf = d.includes('.') ? d.split('.').pop() ?? d : d;

  if (leaf.includes('encrypt')) {
    return 'legacy';
  }
  if (leaf.includes('link')) {
    return 'link';
  }
  if (leaf.includes('attachment')) {
    return 'attachment';
  }
  if (leaf.includes('plain')) {
    return 'plain';
  }

  if (['plain', 'link', 'attachment'].includes(leaf)) {
    return leaf as 'plain' | 'link' | 'attachment';
  }
  if (leaf === 'encrypted') {
    return 'legacy';
  }

  return null;
}

function pickString(
  raw: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'string') {
      return v;
    }
  }
  return undefined;
}

function pickBody(raw: Record<string, unknown>): string {
  return (
    pickString(raw, ['content', 'Content', 'text', 'Text', 'body', 'Body']) ??
    ''
  );
}

function tryParseKeyMap(value: unknown): Record<string, string> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Tries common wire-format property names for per-recipient key material (historical API payloads). */
function pickKeyMapFromPayload(
  raw: Record<string, unknown>,
): Record<string, string> {
  const keyProps = [
    'encryptedKeys',
    'EncryptedKeys',
    'recipientKeys',
    'RecipientKeys',
    'encryptedKeyMap',
    'EncryptedKeyMap',
  ];
  for (const prop of keyProps) {
    const parsed = tryParseKeyMap(raw[prop]);
    if (parsed && Object.keys(parsed).length > 0) {
      return parsed;
    }
  }
  return {};
}

const IV_KEYS = [
  'iv',
  'Iv',
  'IV',
  'initializationVector',
  'InitializationVector',
];

function pickIv(raw: Record<string, unknown>): string | undefined {
  return pickString(raw, IV_KEYS);
}

function hasLegacyBlobPayloadShape(raw: Record<string, unknown>): boolean {
  const keys = pickKeyMapFromPayload(raw);
  const iv = pickIv(raw);
  const body = pickString(raw, ['content', 'Content']);
  return Object.keys(keys).length > 0 && !!iv && body !== undefined;
}

function looksLikeOpaqueBase64Line(s: string): boolean {
  const t = s.trim();
  if (t.length < 16) {
    return false;
  }
  if (/\s/.test(t)) {
    return false;
  }
  return /^[A-Za-z0-9+/]+=*$/.test(t);
}

const UNAVAILABLE_PLACEHOLDER = '[Message content unavailable.]';

/**
 * Normalizes HTTP/SignalR message content to plain, link, or attachment.
 * Historical non-text payloads are replaced with a short placeholder.
 */
export function normalizeMessageContent(raw: unknown): MessageContentUnion {
  if (raw == null || typeof raw !== 'object') {
    return { type: 'plain', $type: 'plain', content: '' };
  }

  const r = raw as Record<string, unknown>;
  const disc = readDiscriminator(r);
  let kind = resolveKind(disc);

  if (hasLegacyBlobPayloadShape(r)) {
    kind = 'legacy';
  }

  if (kind === 'legacy') {
    return { type: 'plain', $type: 'plain', content: UNAVAILABLE_PLACEHOLDER };
  }

  if (kind === 'link') {
    return { type: 'link', $type: 'link', content: pickBody(r) };
  }

  if (kind === 'attachment') {
    const fileName = pickString(r, ['fileName', 'FileName']) ?? 'attachment';
    const mimeType =
      pickString(r, ['mimeType', 'MimeType']) ?? 'application/octet-stream';
    const sizeCandidate = r['sizeBytes'] ?? r['SizeBytes'];
    const sizeBytes =
      typeof sizeCandidate === 'number' && Number.isFinite(sizeCandidate)
        ? sizeCandidate
        : 0;
    return {
      type: 'attachment',
      $type: 'attachment',
      content: pickBody(r),
      fileName,
      mimeType,
      sizeBytes,
    };
  }

  if (kind === 'plain') {
    const body = pickBody(r);
    if (looksLikeOpaqueBase64Line(body)) {
      return {
        type: 'plain',
        $type: 'plain',
        content: UNAVAILABLE_PLACEHOLDER,
      };
    }
    return { type: 'plain', $type: 'plain', content: body };
  }

  const body = pickBody(r);
  if (body.length > 0) {
    if (looksLikeOpaqueBase64Line(body)) {
      return {
        type: 'plain',
        $type: 'plain',
        content: UNAVAILABLE_PLACEHOLDER,
      };
    }
    return { type: 'plain', $type: 'plain', content: body };
  }

  return {
    type: 'plain',
    $type: 'plain',
    content: '',
  };
}
