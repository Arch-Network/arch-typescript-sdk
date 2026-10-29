import { describe, expect, it } from 'vitest';

import { InvalidArgumentError } from '../errors';
import {
  asciiBytes,
  asciiOf,
  base58ToBytes,
  bytesEqual,
  bytesToBase58,
  bytesToHex,
  decodeBase64,
  hexToBytes,
  isHex,
  toByteArray,
} from '../codec/bytes';

describe('hexToBytes / bytesToHex', () => {
  it('round-trips, trims and lowercases', () => {
    const bytes = Uint8Array.from([0, 1, 0xab, 0xff]);
    expect(bytesToHex(bytes)).toBe('0001abff');
    expect(hexToBytes(' 0001ABff ')).toEqual(bytes);
    expect(bytesToHex(new Uint8Array(0))).toBe('');
  });

  it('refuses odd length, non-hex characters and a 0x prefix', () => {
    for (const text of ['abc', 'zz', '0xab', '', 'ab cd']) {
      expect(() => hexToBytes(text), text).toThrow(InvalidArgumentError);
    }
  });
});

describe('bytesEqual', () => {
  it('compares length and content', () => {
    expect(bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2]))).toBe(
      true,
    );
    expect(bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 3]))).toBe(
      false,
    );
    expect(
      bytesEqual(Uint8Array.from([1, 2]), Uint8Array.from([1, 2, 0])),
    ).toBe(false);
  });
});

describe('toByteArray', () => {
  it('copies a Uint8Array, coerces array items, and empties anything else', () => {
    const source = Uint8Array.from([7, 8]);
    const copy = toByteArray(source);
    expect(copy).toEqual(source);
    expect(copy).not.toBe(source);
    expect(toByteArray([1, '2', null, undefined, 'x', 3.7])).toEqual(
      Uint8Array.from([1, 2, 0, 0, 0, 3]),
    );
    for (const value of ['ff'.repeat(32), 42, null, undefined, {}, true]) {
      expect(toByteArray(value)).toEqual(new Uint8Array(0));
    }
  });
});

describe('decodeBase64', () => {
  const latin1 = (bytes: Uint8Array): string =>
    Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  const encode = (bytes: Uint8Array): string => btoa(latin1(bytes));

  it('decodes padded, unpadded and whitespace-laden input like atob', () => {
    for (let length = 0; length < 70; length += 1) {
      const bytes = Uint8Array.from(
        { length },
        (_, index) => (index * 37 + 11) & 0xff,
      );
      const padded = encode(bytes);
      expect(decodeBase64(padded), padded).toEqual(bytes);
      expect(
        decodeBase64(padded.replace(/=+$/, '')),
        `${padded} unpadded`,
      ).toEqual(bytes);
      expect(
        decodeBase64(`\n ${padded.slice(0, 3)}\t${padded.slice(3)} \r`),
        `${padded} whitespace`,
      ).toEqual(bytes);
    }
  });

  it('agrees with atob on acceptance', () => {
    const inputs = [
      'QQ==',
      'QQ=',
      'QQ',
      'Q',
      'QUI=',
      'QUJD',
      'QUJD=',
      'QUJD==',
      'QU JD',
      'QU-D',
      'QUJ*',
      '=',
      '==',
      'QQ===',
      'A===',
      'QQ== ',
      '////',
      '++++',
    ];
    for (const input of inputs) {
      let expected: string | null;
      try {
        expected = atob(input);
      } catch {
        expected = null;
      }
      if (expected === null) {
        expect(() => decodeBase64(input), input).toThrow(InvalidArgumentError);
      } else {
        expect(latin1(decodeBase64(input)), input).toBe(expected);
      }
    }
  });
});

describe('asciiOf', () => {
  it('reads ASCII bytes as text and refuses anything above 0x7f', () => {
    expect(asciiOf(Uint8Array.from([0x32, 0x64, 0x65, 0x62]))).toBe('2deb');
    expect(asciiOf(new Uint8Array(0))).toBe('');
    expect(() => asciiOf(Uint8Array.from([0x41, 0x80]))).toThrow(
      InvalidArgumentError,
    );
  });
});

describe('asciiBytes', () => {
  it('spells ASCII text as bytes and refuses anything above 0x7f', () => {
    expect(asciiBytes('vault')).toEqual(
      Uint8Array.from([0x76, 0x61, 0x75, 0x6c, 0x74]),
    );
    expect(asciiBytes('')).toEqual(new Uint8Array(0));
    expect(() => asciiBytes('é')).toThrow(InvalidArgumentError);
  });
});

describe('isHex', () => {
  it('accepts even-length hex with an optional 0x prefix', () => {
    expect(isHex('0xABcd')).toBe(true);
    expect(isHex('abcd')).toBe(true);
    expect(isHex('abc')).toBe(false);
    expect(isHex('0x')).toBe(false);
    expect(isHex('')).toBe(false);
    expect(isHex('zz')).toBe(false);
    expect(isHex('QUJD')).toBe(false);
  });
});

describe('bytesToBase58 / base58ToBytes', () => {
  it('round-trips a key, keeping one character per leading zero byte', () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff);
    expect(base58ToBytes(bytesToBase58(key))).toEqual(key);
    expect(bytesToBase58(Uint8Array.from([0, 0, 1]))).toBe('112');
  });

  it('spells the zero key as exactly 32 characters, the form a strict decoder accepts', () => {
    expect(bytesToBase58(new Uint8Array(32))).toBe('1'.repeat(32));
    expect(base58ToBytes('1'.repeat(32))).toEqual(new Uint8Array(32));
  });

  it('spells the runtime program ids as their declare_id! strings', () => {
    expect(
      bytesToHex(base58ToBytes('TokenT4em53UrV4gSvZ3nCS2mZeHaqTLapwt6iZt6Mk')),
    ).toBe('06ddf6e1b9ea84412c10b8df021c100fc8871907c309c33535de209c341763bf');
  });

  it('refuses a foreign character and a value above 32 bytes', () => {
    expect(() => base58ToBytes('0')).toThrow(InvalidArgumentError);
    expect(() => base58ToBytes('z'.repeat(45))).toThrow(InvalidArgumentError);
  });
});
