import { Instruction } from '../struct/instruction';
import { AccountMeta } from '../struct/account';
import { Pubkey } from '../struct/pubkey';
import { SYSTEM_PROGRAM_ID } from '../constants';
import { encodeU64LE } from '../codec/borsh';

/**
 * Enum discriminant values must match the order in the Rust
 * `SystemInstruction` enum (arch-network program/src/system_instruction.rs).
 *
 * Post v0.12 / chain-reset (#2708): `CreateAccountWithAnchor` and `Anchor`
 * were removed, shifting every later discriminant down by two. Transfer is
 * now 3 (was 5). Encoding the old values makes the on-chain program try to
 * deserialize CreateAccountWithSeed and fail with "Attempting to read 32 bytes".
 */
export enum SystemInstruction {
  CreateAccount = 0,
  Assign = 1,
  SignInput = 2,
  Transfer = 3,
  Allocate = 4,
  CreateAccountWithSeed = 5,
  AllocateWithSeed = 6,
  AssignWithSeed = 7,
  TransferWithSeed = 8,
}

export const u32ToLeBytes = (num: number): Uint8Array => {
  const arr = new Uint8Array(4);
  new DataView(arr.buffer).setUint32(0, num, true);
  return arr;
};

export const u64ToLeBytes = (num: bigint): Uint8Array => {
  const arr = new Uint8Array(8);
  const view = new DataView(arr.buffer);
  view.setUint32(0, Number(num & 0xffffffffn), true);
  view.setUint32(4, Number((num >> 32n) & 0xffffffffn), true);
  return arr;
};

export const hexStringToUint8Array = (hex: string): Uint8Array => {
  if (hex.length !== 64)
    throw new Error('txid hex string must be 64 characters');
  return new Uint8Array(Buffer.from(hex, 'hex'));
};

const encodeString = (str: string): Uint8Array => {
  const bytes = new TextEncoder().encode(str);
  const lenBytes = u64ToLeBytes(BigInt(bytes.length));
  const result = new Uint8Array(lenBytes.length + bytes.length);
  result.set(lenBytes);
  result.set(bytes, lenBytes.length);
  return result;
};

const anchoringRemovedError = () =>
  new Error(
    'SystemInstruction CreateAccountWithAnchor / Anchor were removed in arch-network v0.12 (chain reset). Accounts are no longer anchored to Bitcoin UTXOs.',
  );

export const createAccount = (
  fromPubkey: Pubkey,
  toPubkey: Pubkey,
  lamports: bigint,
  space: bigint,
  owner: Pubkey,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.CreateAccount);
  const lamportsArray = u64ToLeBytes(lamports);
  const spaceArray = u64ToLeBytes(space);
  const ownerBytes = owner;
  const data = new Uint8Array([
    ...discriminant,
    ...lamportsArray,
    ...spaceArray,
    ...ownerBytes,
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: fromPubkey, is_signer: true, is_writable: true },
    { pubkey: toPubkey, is_signer: true, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

/** @deprecated Removed in arch-network v0.12 — always throws. */
export const createAccountWithAnchor = (
  _fromPubkey: Pubkey,
  _toPubkey: Pubkey,
  _lamports: bigint,
  _space: bigint,
  _owner: Pubkey,
  _txid: string,
  _vout: number,
): Instruction => {
  throw anchoringRemovedError();
};

export const assign = (pubkey: Pubkey, owner: Pubkey): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.Assign);
  const ownerBytes = owner;
  const data = new Uint8Array([...discriminant, ...ownerBytes]);

  const accounts: AccountMeta[] = [
    { pubkey, is_signer: true, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

/** @deprecated Removed in arch-network v0.12 — always throws. */
export const anchor = (
  _pubkey: Pubkey,
  _txid: string,
  _vout: number,
): Instruction => {
  throw anchoringRemovedError();
};

export const signInput = (index: number, signer: Pubkey): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.SignInput);
  const indexArray = u32ToLeBytes(index);
  const data = new Uint8Array([...discriminant, ...indexArray]);

  const accounts: AccountMeta[] = [
    { pubkey: signer, is_signer: true, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const transfer = (
  fromPubkey: Pubkey,
  toPubkey: Pubkey,
  lamports: bigint,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.Transfer);
  // Range-checked: a masked 2^64 would transfer 0, a negative amount u64::MAX.
  const lamportsBytes = encodeU64LE(lamports);
  const data = new Uint8Array([...discriminant, ...lamportsBytes]);

  const accounts: AccountMeta[] = [
    { pubkey: fromPubkey, is_signer: true, is_writable: true },
    { pubkey: toPubkey, is_signer: false, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const allocate = (pubkey: Pubkey, space: bigint): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.Allocate);
  const spaceArray = u64ToLeBytes(space);
  const data = new Uint8Array([...discriminant, ...spaceArray]);

  const accounts: AccountMeta[] = [
    { pubkey, is_signer: true, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const createAccountWithSeed = (
  fromPubkey: Pubkey,
  toPubkey: Pubkey,
  base: Pubkey,
  seed: string,
  lamports: bigint,
  space: bigint,
  owner: Pubkey,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.CreateAccountWithSeed);
  const baseBytes = base;
  const seedBytes = encodeString(seed);
  const lamportsArray = u64ToLeBytes(lamports);
  const spaceArray = u64ToLeBytes(space);
  const ownerBytes = owner;

  const data = new Uint8Array([
    ...discriminant,
    ...baseBytes,
    ...seedBytes,
    ...lamportsArray,
    ...spaceArray,
    ...ownerBytes,
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: fromPubkey, is_signer: true, is_writable: true },
    { pubkey: toPubkey, is_signer: false, is_writable: true },
  ];

  if (
    base.length !== fromPubkey.length ||
    !base.every((v, i) => v === fromPubkey[i])
  ) {
    accounts.push({ pubkey: base, is_signer: true, is_writable: false });
  }

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const allocateWithSeed = (
  address: Pubkey,
  base: Pubkey,
  seed: string,
  space: bigint,
  owner: Pubkey,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.AllocateWithSeed);
  const baseBytes = base;
  const seedBytes = encodeString(seed);
  const spaceArray = u64ToLeBytes(space);
  const ownerBytes = owner;

  const data = new Uint8Array([
    ...discriminant,
    ...baseBytes,
    ...seedBytes,
    ...spaceArray,
    ...ownerBytes,
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: address, is_signer: false, is_writable: true },
    { pubkey: base, is_signer: true, is_writable: false },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const assignWithSeed = (
  address: Pubkey,
  base: Pubkey,
  seed: string,
  owner: Pubkey,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.AssignWithSeed);
  const baseBytes = base;
  const seedBytes = encodeString(seed);
  const ownerBytes = owner;

  const data = new Uint8Array([
    ...discriminant,
    ...baseBytes,
    ...seedBytes,
    ...ownerBytes,
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: address, is_signer: false, is_writable: true },
    { pubkey: base, is_signer: true, is_writable: false },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};

export const transferWithSeed = (
  fromPubkey: Pubkey,
  fromBase: Pubkey,
  fromSeed: string,
  fromOwner: Pubkey,
  toPubkey: Pubkey,
  lamports: bigint,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.TransferWithSeed);
  const lamportsBytes = u64ToLeBytes(lamports);
  const seedBytes = encodeString(fromSeed);
  const ownerBytes = fromOwner;

  const data = new Uint8Array([
    ...discriminant,
    ...lamportsBytes,
    ...seedBytes,
    ...ownerBytes,
  ]);

  const accounts: AccountMeta[] = [
    { pubkey: fromPubkey, is_signer: false, is_writable: true },
    { pubkey: fromBase, is_signer: true, is_writable: false },
    { pubkey: toPubkey, is_signer: false, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
};
