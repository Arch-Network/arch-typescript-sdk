import { InvalidArgumentError } from '../errors';

// Every encoder refuses a value outside its type's range rather than masking it: a masked 2^64 would encode as 0 and a
// negative u64 as u64::MAX. Decoders read missing bytes as 0; callers check the account length first.

const U64_MAX = (1n << 64n) - 1n;
const U128_MAX = (1n << 128n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const I128_MIN = -(1n << 127n);
const I128_MAX = (1n << 127n) - 1n;

function assertInteger(
  value: number,
  min: number,
  max: number,
  type: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidArgumentError(`${type} out of range: ${String(value)}`);
  }
}

function assertBigInt(
  value: bigint,
  min: bigint,
  max: bigint,
  type: string,
): void {
  if (value < min || value > max)
    throw new InvalidArgumentError(`${type} out of range: ${value.toString()}`);
}

function unsignedLE(value: bigint, bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  let v = value;
  for (let i = 0; i < bytes; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function encodeU16LE(value: number): Uint8Array {
  assertInteger(value, 0, 0xffff, 'u16');
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
}

export function encodeU32LE(value: number): Uint8Array {
  assertInteger(value, 0, 0xffff_ffff, 'u32');
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

export function encodeU64LE(value: bigint): Uint8Array {
  assertBigInt(value, 0n, U64_MAX, 'u64');
  return unsignedLE(value, 8);
}

export function encodeU128LE(value: bigint): Uint8Array {
  assertBigInt(value, 0n, U128_MAX, 'u128');
  return unsignedLE(value, 16);
}

export function encodeI32LE(value: number): Uint8Array {
  assertInteger(value, -0x8000_0000, 0x7fff_ffff, 'i32');
  return Uint8Array.of(
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  );
}

export function encodeI64LE(value: bigint): Uint8Array {
  assertBigInt(value, I64_MIN, I64_MAX, 'i64');
  return unsignedLE(value < 0n ? value + (1n << 64n) : value, 8);
}

export function encodeI128LE(value: bigint): Uint8Array {
  assertBigInt(value, I128_MIN, I128_MAX, 'i128');
  return unsignedLE(value < 0n ? value + (1n << 128n) : value, 16);
}

export function decodeU16LE(data: Uint8Array, offset: number): number {
  return (data[offset] ?? 0) | ((data[offset + 1] ?? 0) << 8);
}

/** `>>> 0` keeps the top bit unsigned, which a bitwise `|` alone would sign. */
export function decodeU32LE(data: Uint8Array, offset: number): number {
  return (
    ((data[offset] ?? 0) |
      ((data[offset + 1] ?? 0) << 8) |
      ((data[offset + 2] ?? 0) << 16) |
      ((data[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function unsignedAt(data: Uint8Array, offset: number, bytes: number): bigint {
  let value = 0n;
  for (let i = bytes - 1; i >= 0; i -= 1)
    value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  return value;
}

export function decodeU64LE(data: Uint8Array, offset: number): bigint {
  return unsignedAt(data, offset, 8);
}

export function decodeU128LE(data: Uint8Array, offset: number): bigint {
  return unsignedAt(data, offset, 16);
}

/** Bitwise `|` produces a signed 32-bit integer, so the top byte's sign is the i32's. */
export function decodeI32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)
  );
}

export function decodeI64LE(data: Uint8Array, offset: number): bigint {
  const unsigned = decodeU64LE(data, offset);
  return unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned;
}

export function decodeI128LE(data: Uint8Array, offset: number): bigint {
  const unsigned = unsignedAt(data, offset, 16);
  return unsigned >= 1n << 127n ? unsigned - (1n << 128n) : unsigned;
}

export function decodeBool(data: Uint8Array, offset: number): boolean {
  return (data[offset] ?? 0) !== 0;
}

/** A copy of the 32 bytes at `offset`. */
export function decodePubkey(data: Uint8Array, offset: number): Uint8Array {
  return data.slice(offset, offset + 32);
}
