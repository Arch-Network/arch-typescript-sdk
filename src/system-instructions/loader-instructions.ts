import { BPF_LOADER_PROGRAM_ID, RUNTIME_TX_SIZE_LIMIT } from '../constants';
import { AccountMeta } from '../struct/account';
import { Instruction } from '../struct/instruction';
import { Pubkey } from '../struct/pubkey';
import { RuntimeTransaction } from '../struct/runtime-transaction';
import { createSanitizedMessage } from '../serde/sanitized-message';
import { serialize as serializeTransaction } from '../serde/transaction';
import { u32ToLeBytes, u64ToLeBytes } from './system-instructions';

/**
 * Discriminant values must match `LoaderInstruction` in
 * arch-network program/src/loader_instruction.rs.
 * Bincode 1.3 encodes the enum variant as u32 LE (#[repr(u8)] is layout only).
 */
export enum LoaderInstruction {
  Write = 0,
  Truncate = 1,
  Deploy = 2,
  Retract = 3,
  TransferAuthority = 4,
  Finalize = 5,
}

const encodeWriteBytes = (bytes: Uint8Array): Uint8Array => {
  const len = u64ToLeBytes(BigInt(bytes.length));
  const data = new Uint8Array(len.length + bytes.length);
  data.set(len);
  data.set(bytes, len.length);
  return data;
};

export const write = (
  programAccount: Pubkey,
  authority: Pubkey,
  offset: number,
  bytes: Uint8Array,
): Instruction => {
  const data = new Uint8Array([
    ...u32ToLeBytes(LoaderInstruction.Write),
    ...u32ToLeBytes(offset),
    ...encodeWriteBytes(bytes),
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: false, is_writable: true },
    { pubkey: authority, is_signer: true, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data,
  };
};

export const truncate = (
  programAccount: Pubkey,
  authority: Pubkey,
  newSize: number,
): Instruction => {
  const data = new Uint8Array([
    ...u32ToLeBytes(LoaderInstruction.Truncate),
    ...u32ToLeBytes(newSize),
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: true, is_writable: true },
    { pubkey: authority, is_signer: true, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data,
  };
};

export const deploy = (
  programAccount: Pubkey,
  authority: Pubkey,
): Instruction => {
  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: false, is_writable: true },
    { pubkey: authority, is_signer: true, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data: u32ToLeBytes(LoaderInstruction.Deploy),
  };
};

export const retract = (
  programAccount: Pubkey,
  authority: Pubkey,
): Instruction => {
  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: false, is_writable: true },
    { pubkey: authority, is_signer: true, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data: u32ToLeBytes(LoaderInstruction.Retract),
  };
};

export const transferAuthority = (
  programAccount: Pubkey,
  currentAuthority: Pubkey,
  newAuthority: Pubkey,
): Instruction => {
  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: true, is_writable: true },
    { pubkey: currentAuthority, is_signer: true, is_writable: false },
    { pubkey: newAuthority, is_signer: true, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data: u32ToLeBytes(LoaderInstruction.TransferAuthority),
  };
};

export const finalize = (
  programAccount: Pubkey,
  authority: Pubkey,
  nextVersion: Pubkey,
): Instruction => {
  const accounts: AccountMeta[] = [
    { pubkey: programAccount, is_signer: true, is_writable: true },
    { pubkey: authority, is_signer: true, is_writable: false },
    { pubkey: nextVersion, is_signer: false, is_writable: false },
  ];

  return {
    program_id: BPF_LOADER_PROGRAM_ID,
    accounts,
    data: u32ToLeBytes(LoaderInstruction.Finalize),
  };
};

/**
 * Largest loader Write payload that still fits in RUNTIME_TX_SIZE_LIMIT.
 * Matches arch_sdk::extend_bytes_max_len.
 */
export const extendBytesMaxLen = (): number => {
  const programPubkey = new Uint8Array(32).fill(1);
  const authorityPubkey = new Uint8Array(32).fill(2);
  const message = createSanitizedMessage(
    [write(programPubkey, authorityPubkey, 0, new Uint8Array(0))],
    null,
    new Uint8Array(32),
  );

  if (typeof message === 'string') {
    throw new Error(`failed to compile write message: ${message}`);
  }

  const transaction: RuntimeTransaction = {
    version: 0,
    signatures: [new Uint8Array(64)],
    message,
  };

  return RUNTIME_TX_SIZE_LIMIT - serializeTransaction(transaction).length;
};
