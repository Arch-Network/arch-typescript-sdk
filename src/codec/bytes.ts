import { InvalidArgumentError } from '../errors';

const LOWER_HEX = /^[0-9a-f]+$/;
const ANY_HEX = /^[0-9a-fA-F]+$/;
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_BODY = /^[A-Za-z0-9+/]*$/;
const ASCII_WHITESPACE = /[\t\n\f\r ]/g;
const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Trims and lowercases; refuses an empty string, odd length, a `0x` prefix or a non-hex character. */
export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (!LOWER_HEX.test(normalized) || normalized.length % 2 !== 0)
    throw new InvalidArgumentError('Invalid hex string.');
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i += 1)
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Lowercase, unprefixed. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** A copy of a `Uint8Array`, a JSON `number[]` coerced item by item (non-numbers become 0), and empty for anything else. */
export function toByteArray(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value))
    return Uint8Array.from(value, (item: unknown) => Number(item) || 0);
  return new Uint8Array(0);
}

/** The WHATWG forgiving-base64 decode (`atob`): ASCII whitespace ignored, padding optional when the length is a multiple of four. */
export function decodeBase64(text: string): Uint8Array {
  let body = text.replace(ASCII_WHITESPACE, '');
  if (body.length % 4 === 0) {
    if (body.endsWith('==')) body = body.slice(0, -2);
    else if (body.endsWith('=')) body = body.slice(0, -1);
  }
  if (body.length % 4 === 1 || !BASE64_BODY.test(body))
    throw new InvalidArgumentError('Invalid base64 string.');
  const out = new Uint8Array(Math.floor((body.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of body) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index] = (buffer >> bits) & 0xff;
      index += 1;
      buffer &= (1 << bits) - 1;
    }
  }
  return out;
}

/** Bytes as ASCII text; refuses a byte above 0x7f. */
export function asciiOf(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    if (byte >= 0x80)
      throw new InvalidArgumentError(
        `asciiOf: byte ${String(byte)} is outside ASCII`,
      );
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Non-empty, even-length hex of either case, with an optional `0x` prefix. */
export function isHex(value: string): boolean {
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  return ANY_HEX.test(normalized) && normalized.length % 2 === 0;
}

/** Base58 (Bitcoin alphabet), one `1` per leading zero byte. */
export function bytesToBase58(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros += 1;
  }
  // All zeros: the digit loop below would add a spurious "1" after the one each zero byte already spells.
  if (leadingZeros === bytes.length) return '1'.repeat(leadingZeros);
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += (digits[i] ?? 0) << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '1'.repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i -= 1)
    out += BASE58_ALPHABET[digits[i] ?? 0];
  return out;
}

/** A base58 32-byte key to bytes, left-padded with zeros; refuses a foreign character or a value above 32 bytes. */
export function base58ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(32);
  for (const char of text) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) throw new InvalidArgumentError('Invalid base58 character.');
    for (let i = bytes.length - 1; i >= 0; i -= 1) {
      carry += 58 * (bytes[i] ?? 0);
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    if (carry > 0)
      throw new InvalidArgumentError('Base58 value exceeds 32 bytes.');
  }
  return bytes;
}

/** The ASCII bytes of `text`, for PDA seeds; refuses a non-ASCII character. */
export function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0x80)
      throw new InvalidArgumentError(
        `asciiBytes: character ${String(code)} is outside ASCII`,
      );
    out[i] = code;
  }
  return out;
}
