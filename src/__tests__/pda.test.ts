import { afterEach, describe, expect, it } from 'vitest';

import vectors from './fixtures/program-helpers-vectors.json';
import { bytesToHex, hexToBytes } from '../codec/bytes';
import { findProgramAddress, toHex } from '../serde/pubkey';
import { associatedTokenAddress } from '../token/instructions';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../constants';

const globals = globalThis as { Buffer?: unknown };
const NodeBuffer = globals.Buffer;

afterEach(() => {
  globals.Buffer = NodeBuffer;
});

describe('program addresses without a global Buffer', () => {
  it('derives the recorded addresses with Buffer undefined, as in a browser', () => {
    globals.Buffer = undefined;
    for (const { owner, mint, ata } of vectors.ata) {
      expect(
        bytesToHex(associatedTokenAddress(hexToBytes(owner), hexToBytes(mint))),
      ).toBe(ata);
    }
    expect(toHex(new Uint8Array(32).fill(0xab))).toBe('ab'.repeat(32));
  });

  it('returns the bump with the address and accepts a readonly seed list', () => {
    globals.Buffer = undefined;
    const [vector] = vectors.ata;
    if (vector === undefined) throw new Error('missing vector');
    const seeds: readonly Uint8Array[] = [
      hexToBytes(vector.owner),
      TOKEN_PROGRAM_ID,
      hexToBytes(vector.mint),
    ];
    const [address, bump] = findProgramAddress(
      seeds,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    expect(bytesToHex(address)).toBe(vector.ata);
    expect(bump).toBeGreaterThan(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});
