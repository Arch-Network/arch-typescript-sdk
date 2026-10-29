import { Schema } from 'borsh';
export interface SanitizedInstruction {
  program_id_index: number;
  accounts: Array<number>;
  data: Uint8Array;
}

/** A `SanitizedInstruction` read-only throughout; what serialisation accepts. */
export interface ReadonlySanitizedInstruction {
  readonly program_id_index: number;
  readonly accounts: readonly number[];
  readonly data: Uint8Array;
}

export const SanitizedInstructionSchema: Schema = {
  struct: {
    program_id_index: 'u8',
    accounts: {
      array: {
        type: 'u8',
      },
    },
    data: {
      array: {
        type: 'u8',
      },
    },
  },
};
