import { describe, expect, it } from 'vitest';

import { InvalidArgumentError } from '../errors';
import { bytesToHex } from '../codec/bytes';
import {
  decodeBool,
  decodeI128LE,
  decodeI32LE,
  decodeI64LE,
  decodePubkey,
  decodeU128LE,
  decodeU16LE,
  decodeU32LE,
  decodeU64LE,
  encodeI128LE,
  encodeI32LE,
  encodeI64LE,
  encodeU128LE,
  encodeU16LE,
  encodeU32LE,
  encodeU64LE,
} from '../codec/borsh';

describe('borsh integer encoders', () => {
  it('round-trip through their decoders at the range edges', () => {
    expect(decodeU64LE(encodeU64LE((1n << 64n) - 1n), 0)).toBe(
      (1n << 64n) - 1n,
    );
    expect(decodeU64LE(encodeU64LE(9_007_199_254_740_993n), 0)).toBe(
      9_007_199_254_740_993n,
    );
    expect(decodeU128LE(encodeU128LE((1n << 128n) - 1n), 0)).toBe(
      (1n << 128n) - 1n,
    );
    expect(decodeI32LE(encodeI32LE(-68_544), 0)).toBe(-68_544);
    expect(decodeI32LE(encodeI32LE(-0x8000_0000), 0)).toBe(-0x8000_0000);
    expect(decodeI64LE(encodeI64LE(-(1n << 63n)), 0)).toBe(-(1n << 63n));
    expect(decodeI64LE(encodeI64LE((1n << 63n) - 1n), 0)).toBe(
      (1n << 63n) - 1n,
    );
    expect(decodeI64LE(encodeI64LE(-1n), 0)).toBe(-1n);
    expect(decodeI128LE(encodeI128LE(-(1n << 127n)), 0)).toBe(-(1n << 127n));
    expect(decodeI128LE(encodeI128LE(-500_000_000_000_000n), 0)).toBe(
      -500_000_000_000_000n,
    );
    expect(decodeU16LE(encodeU16LE(64), 0)).toBe(64);
    expect(bytesToHex(encodeU32LE(0xffff_ffff))).toBe('ffffffff');
    expect(decodeU32LE(encodeU32LE(0xffff_ffff), 0)).toBe(0xffff_ffff);
    expect(bytesToHex(encodeI64LE(-2n))).toBe('feffffffffffffff');
  });

  it('refuses a value outside the type instead of masking it', () => {
    expect(() => encodeU64LE(1n << 64n)).toThrow(InvalidArgumentError);
    expect(() => encodeU64LE(-1n)).toThrow(InvalidArgumentError);
    expect(() => encodeU128LE(1n << 128n)).toThrow(InvalidArgumentError);
    expect(() => encodeI32LE(2_147_483_648)).toThrow(InvalidArgumentError);
    expect(() => encodeI32LE(1.5)).toThrow(InvalidArgumentError);
    expect(() => encodeI64LE(1n << 63n)).toThrow(InvalidArgumentError);
    expect(() => encodeI64LE(-(1n << 63n) - 1n)).toThrow(InvalidArgumentError);
    expect(() => encodeI128LE(1n << 127n)).toThrow(InvalidArgumentError);
    expect(() => encodeU16LE(70_000)).toThrow(InvalidArgumentError);
    expect(() => encodeU16LE(-1)).toThrow(InvalidArgumentError);
    expect(() => encodeU32LE(-1)).toThrow(InvalidArgumentError);
    expect(() => encodeU64LE(1n << 64n)).toThrow(/u64 out of range/);
  });
});

describe('borsh readers', () => {
  it('read at an offset, missing bytes as zero', () => {
    const data = Uint8Array.from([9, 1, 0, 0x80]);
    expect(decodeU16LE(data, 1)).toBe(1);
    expect(decodeU16LE(data, 3)).toBe(0x80);
    expect(decodeBool(data, 0)).toBe(true);
    expect(decodeBool(data, 2)).toBe(false);
    expect(decodeBool(data, 9)).toBe(false);
  });

  it('copies a pubkey rather than aliasing the account data', () => {
    const data = Uint8Array.from({ length: 40 }, (_, i) => i);
    const key = decodePubkey(data, 4);
    expect(key).toEqual(Uint8Array.from({ length: 32 }, (_, i) => i + 4));
    data[4] = 0xff;
    expect(key[0]).toBe(4);
  });
});
