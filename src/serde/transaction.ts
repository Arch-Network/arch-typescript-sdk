import { hex } from '@scure/base';
import {
  MAX_SIGNERS,
  RUNTIME_TX_SIZE_LIMIT,
} from '../constants';
import { RuntimeTransaction } from '../struct/runtime-transaction';
import {
  serialize as serializeMessage,
  toHex as messageToHex,
  toNumberArray as messageToNumberArray,
} from './sanitized-message';

export const serialize = (transaction: RuntimeTransaction): Uint8Array => {
  if (transaction.signatures.length > MAX_SIGNERS) {
    throw new Error(
      `too many signatures: allowed ${MAX_SIGNERS}, found ${transaction.signatures.length}`,
    );
  }

  const versionBytes = new Uint8Array(4);
  new DataView(versionBytes.buffer).setUint32(0, transaction.version, true);

  const signatureBytes = transaction.signatures.flatMap((signature) =>
    Array.from(signature),
  );

  return new Uint8Array([
    ...versionBytes,
    transaction.signatures.length,
    ...signatureBytes,
    ...serializeMessage(transaction.message),
  ]);
};

export const serializedSize = (transaction: RuntimeTransaction): number =>
  serialize(transaction).length;

export const checkTxSizeLimit = (transaction: RuntimeTransaction): void => {
  const size = serializedSize(transaction);
  if (size > RUNTIME_TX_SIZE_LIMIT) {
    throw new Error(
      `runtime transaction size exceeds limit: ${size} > ${RUNTIME_TX_SIZE_LIMIT}`,
    );
  }
};

export const toHex = (transaction: RuntimeTransaction) => {
  return {
    version: transaction.version,
    signatures: transaction.signatures.map((signature) =>
      hex.encode(signature),
    ),
    message: messageToHex(transaction.message),
  };
};

export const toNumberArray = (transaction: RuntimeTransaction) => {
  return {
    version: transaction.version,
    signatures: transaction.signatures.map((signature) =>
      Array.from(signature),
    ),
    message: messageToNumberArray(transaction.message),
  };
};
