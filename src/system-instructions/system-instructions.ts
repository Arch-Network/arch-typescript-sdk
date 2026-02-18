import { Instruction } from '../struct/instruction';
import { AccountMeta } from '../struct/account';
import { Pubkey } from '../struct/pubkey';
import { SYSTEM_PROGRAM_ID } from '../constants';

/**
 * Enum discriminant values must match the order in the Rust
 * `SystemInstruction` enum (arch-network program/src/system_instruction.rs).
 */
export enum SystemInstruction {
  CreateAccount = 0,
  CreateAccountWithAnchor = 1,
  Assign = 2,
  Anchor = 3,
  SignInput = 4,
  Transfer = 5,
  Allocate = 6,
  CreateAccountWithSeed = 7,
  AllocateWithSeed = 8,
  AssignWithSeed = 9,
  TransferWithSeed = 10,
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

export const createAccountWithAnchor = (
  fromPubkey: Pubkey,
  toPubkey: Pubkey,
  lamports: bigint,
  space: bigint,
  owner: Pubkey,
  txid: string,
  vout: number,
): Instruction => {
  const txidBytes = hexStringToUint8Array(txid);
  if (txidBytes.length !== 32) {
    throw new Error('txid must be 32 bytes');
  }

  const discriminant = u32ToLeBytes(SystemInstruction.CreateAccountWithAnchor);
  const lamportsArray = u64ToLeBytes(lamports);
  const spaceArray = u64ToLeBytes(space);
  const ownerBytes = owner;
  const voutArray = u32ToLeBytes(vout);

  const data = new Uint8Array([
    ...discriminant,
    ...lamportsArray,
    ...spaceArray,
    ...ownerBytes,
    ...txidBytes,
    ...voutArray,
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

export const anchor = (
  pubkey: Pubkey,
  txid: string,
  vout: number,
): Instruction => {
  const discriminant = u32ToLeBytes(SystemInstruction.Anchor);
  const txidBytes = hexStringToUint8Array(txid);
  const voutArray = u32ToLeBytes(vout);
  const data = new Uint8Array([...discriminant, ...txidBytes, ...voutArray]);

  const accounts: AccountMeta[] = [
    { pubkey, is_signer: true, is_writable: true },
  ];

  return {
    program_id: SYSTEM_PROGRAM_ID,
    accounts,
    data,
  };
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
  const lamportsBytes = u64ToLeBytes(lamports);
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
