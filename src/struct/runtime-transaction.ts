import {
  ReadonlySanitizedMessage,
  SanitizedMessage,
} from './sanitized-message';

// 64 bytes
export type Signature = Uint8Array;

export interface RuntimeTransaction {
  version: number;
  signatures: Array<Signature>;
  message: SanitizedMessage;
}

/** A `RuntimeTransaction` read-only throughout; what serialisation and `transactionId` accept, so frozen or `readonly`-typed transactions pass without copying. */
export interface ReadonlyRuntimeTransaction {
  readonly version: number;
  readonly signatures: readonly Signature[];
  readonly message: ReadonlySanitizedMessage;
}
