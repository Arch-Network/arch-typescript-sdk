import { describe, expect, it } from 'vitest';

import { SYSTEM_PROGRAM_ID } from '../constants';
import { transfer } from '../system-instructions/system-instructions';

const SENDER = new Uint8Array(32).fill(0x11);
const RECIPIENT = new Uint8Array(32).fill(0x22);

describe('SystemInstruction.transfer', () => {
  // Pinned against the node: v0.12.0 dropped two variants, so the old tag 5 now reads as `CreateAccountWithSeed`.
  it('encodes variant 3 as u32 LE, then the lamports as u64 LE', () => {
    const { data } = transfer(SENDER, RECIPIENT, 1_000n);
    expect(data).toHaveLength(12);
    expect(Array.from(data.slice(0, 4))).toEqual([3, 0, 0, 0]);
    expect(Array.from(data.slice(4))).toEqual([0xe8, 0x03, 0, 0, 0, 0, 0, 0]);
  });

  it('spans the u64 and refuses what it cannot hold', () => {
    const max = (1n << 64n) - 1n;
    expect(Array.from(transfer(SENDER, RECIPIENT, max).data.slice(4))).toEqual(
      Array<number>(8).fill(0xff),
    );
    expect(Array.from(transfer(SENDER, RECIPIENT, 0n).data.slice(4))).toEqual(
      Array<number>(8).fill(0),
    );
    expect(() => transfer(SENDER, RECIPIENT, max + 1n)).toThrow(
      /u64 out of range/,
    );
    expect(() => transfer(SENDER, RECIPIENT, -1n)).toThrow(/u64 out of range/);
  });

  it("names the system program and the accounts in the node's order", () => {
    const instruction = transfer(SENDER, RECIPIENT, 1n);
    expect(instruction.program_id).toEqual(SYSTEM_PROGRAM_ID);
    expect(instruction.accounts).toEqual([
      { pubkey: SENDER, is_signer: true, is_writable: true },
      { pubkey: RECIPIENT, is_signer: false, is_writable: true },
    ]);
  });
});
