import { describe, expect, it } from 'vitest';
import { RUNTIME_TX_SIZE_LIMIT } from '../constants';
import { serialize } from '../serde/transaction';
import { createSanitizedMessage } from '../serde/sanitized-message';
import {
  extendBytesMaxLen,
  write,
} from '../system-instructions/loader-instructions';
import { RuntimeTransaction } from '../struct/runtime-transaction';

describe('loader write chunking', () => {
  it('serializes Write as bincode variant u32 + offset u32 + vec u64 + bytes', () => {
    const program = new Uint8Array(32).fill(1);
    const authority = new Uint8Array(32).fill(2);
    const bytes = new Uint8Array([9, 8, 7]);
    const ix = write(program, authority, 16, bytes);

    expect(Array.from(ix.data.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(ix.data.slice(4, 8))).toEqual([16, 0, 0, 0]);
    expect(Array.from(ix.data.slice(8, 16))).toEqual([3, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(ix.data.slice(16))).toEqual([9, 8, 7]);
  });

  it('extendBytesMaxLen fills RUNTIME_TX_SIZE_LIMIT exactly', () => {
    const maxLen = extendBytesMaxLen();
    expect(maxLen).toBeGreaterThan(0);
    expect(maxLen).toBeLessThan(RUNTIME_TX_SIZE_LIMIT);

    const programPubkey = new Uint8Array(32).fill(1);
    const authorityPubkey = new Uint8Array(32).fill(2);
    const message = createSanitizedMessage(
      [write(programPubkey, authorityPubkey, 0, new Uint8Array(maxLen))],
      null,
      new Uint8Array(32),
    );

    expect(typeof message).not.toBe('string');
    if (typeof message === 'string') {
      throw new Error(message);
    }

    const transaction: RuntimeTransaction = {
      version: 0,
      signatures: [new Uint8Array(64)],
      message,
    };

    expect(serialize(transaction).length).toBe(RUNTIME_TX_SIZE_LIMIT);
  });
});
