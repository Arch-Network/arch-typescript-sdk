import { describe, expect, it } from 'vitest';

import vectors from './fixtures/program-helpers-vectors.json';
import { transactionId } from '../txid';
import type { RuntimeTransaction } from '../struct/runtime-transaction';

interface WireRuntimeTransaction {
  version: number;
  signatures: number[][];
  message: {
    header: RuntimeTransaction['message']['header'];
    account_keys: number[][];
    recent_blockhash: number[];
    instructions: {
      program_id_index: number;
      accounts: number[];
      data: number[];
    }[];
  };
}

function fromWire(wire: WireRuntimeTransaction): RuntimeTransaction {
  return {
    version: wire.version,
    signatures: wire.signatures.map((signature) => Uint8Array.from(signature)),
    message: {
      header: wire.message.header,
      account_keys: wire.message.account_keys.map((key) =>
        Uint8Array.from(key),
      ),
      recent_blockhash: Uint8Array.from(wire.message.recent_blockhash),
      instructions: wire.message.instructions.map((ix) => ({
        program_id_index: ix.program_id_index,
        accounts: ix.accounts,
        data: Uint8Array.from(ix.data),
      })),
    },
  };
}

describe('transactionId', () => {
  it.each(vectors.txid)(
    'derives the id the validator issued for a signed mainnet transaction ($id)',
    ({ txid, runtime_transaction }) => {
      expect(transactionId(fromWire(runtime_transaction))).toBe(txid);
    },
  );

  it('changes with the signatures, which the message hash does not cover', () => {
    const [claim] = vectors.txid;
    if (claim === undefined) throw new Error('missing vector');
    const tx = fromWire(claim.runtime_transaction);
    const resigned = {
      ...tx,
      signatures: [new Uint8Array(64)],
    };
    expect(transactionId(resigned)).not.toBe(claim.txid);
  });
});
