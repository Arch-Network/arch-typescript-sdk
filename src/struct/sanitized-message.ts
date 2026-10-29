import { Schema } from 'borsh';
import { Pubkey, PubkeySchema } from './pubkey';
import { MessageHeader, MessageHeaderSchema } from './header';
import {
  ReadonlySanitizedInstruction,
  SanitizedInstruction,
  SanitizedInstructionSchema,
} from './sanitized-instruction';

export interface SanitizedMessage {
  header: MessageHeader;
  account_keys: Array<Pubkey>;
  recent_blockhash: Uint8Array;
  instructions: Array<SanitizedInstruction>;
}

/** A `SanitizedMessage` read-only throughout; what serialisation accepts. */
export interface ReadonlySanitizedMessage {
  readonly header: Readonly<MessageHeader>;
  readonly account_keys: readonly Pubkey[];
  readonly recent_blockhash: Uint8Array;
  readonly instructions: readonly ReadonlySanitizedInstruction[];
}

export const SanitizedMessageSchema: Schema = {
  struct: {
    header: MessageHeaderSchema,
    account_keys: {
      array: {
        type: PubkeySchema,
      },
    },
    recent_blockhash: {
      array: {
        type: 'u8',
        len: 32,
      },
    },
    instructions: {
      array: {
        type: SanitizedInstructionSchema,
      },
    },
  },
};
