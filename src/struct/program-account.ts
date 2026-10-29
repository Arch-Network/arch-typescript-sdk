import { Pubkey } from './pubkey';
import { AccountInfoResult } from './account';

export type AccountFilter =
  | { DataSize: number }
  | { DataContent: { offset: number; bytes: Uint8Array } };

/**
 * A `get_program_accounts` filter as the validator's JSON-RPC parses it: `DataContent.bytes` is a JSON array of numbers.
 * `getProgramAccounts` sends an `AccountFilter` in this shape, and sends this shape unchanged, so program SDKs can build
 * filters without `Uint8Array`s.
 */
export type ProgramAccountFilter =
  | { readonly DataSize: number }
  | {
      readonly DataContent: {
        readonly offset: number;
        readonly bytes: readonly number[];
      };
    };

export interface ProgramAccount {
  pubkey: Pubkey;
  account: AccountInfoResult;
}
