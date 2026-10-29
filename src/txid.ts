import { sha256 } from '@noble/hashes/sha256';
import { asciiBytes, bytesToHex } from './codec/bytes';
import { serialize } from './serde/transaction';
import { RuntimeTransaction } from './struct/runtime-transaction';

/** `RuntimeTransaction::txid`: `hex(sha256(ascii(hex(sha256(serialize(tx))))))`, the id the validator issues for a signed transaction. */
export function transactionId(tx: RuntimeTransaction): string {
  return bytesToHex(sha256(asciiBytes(bytesToHex(sha256(serialize(tx))))));
}
