import { Pubkey } from './pubkey';
import { AccountInfoResult } from './account';

export type AccountFilter =
  | { DataSize: number }
  | { DataContent: { offset: number; bytes: Uint8Array } };

export interface ProgramAccount {
  pubkey: Pubkey;
  account: AccountInfoResult;
}
