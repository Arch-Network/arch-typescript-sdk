import { decodePubkey, decodeU32LE, decodeU64LE } from '../codec/borsh';

// The APL token program's two account layouts, SPL Token classic byte for byte: `Mint` 82 bytes, `Account` 165 bytes.
// A `COption<Pubkey>` is a u32 tag followed by 32 bytes.

export const APL_MINT_SIZE = 82;
export const APL_TOKEN_ACCOUNT_SIZE = 165;

export class MalformedAplAccountError extends Error {
  override readonly name = 'MalformedAplAccountError';
}

export interface AplMint {
  readonly mintAuthority: Uint8Array | null;
  readonly supply: bigint;
  readonly decimals: number;
  readonly isInitialized: boolean;
  readonly freezeAuthority: Uint8Array | null;
}

export interface AplTokenAccount {
  readonly mint: Uint8Array;
  readonly owner: Uint8Array;
  readonly amount: bigint;
  /** 0 uninitialized, 1 initialized, 2 frozen. */
  readonly state: number;
}

function coption(data: Uint8Array, offset: number): Uint8Array | null {
  return decodeU32LE(data, offset) === 0
    ? null
    : decodePubkey(data, offset + 4);
}

/** Refuses data shorter than {@link APL_MINT_SIZE}; trailing bytes are ignored. */
export function decodeAplMint(data: Uint8Array): AplMint {
  if (data.length < APL_MINT_SIZE)
    throw new MalformedAplAccountError(
      `APL mint is ${String(data.length)} bytes, expected ${String(APL_MINT_SIZE)}`,
    );
  return {
    mintAuthority: coption(data, 0),
    supply: decodeU64LE(data, 36),
    decimals: data[44] ?? 0,
    isInitialized: (data[45] ?? 0) !== 0,
    freezeAuthority: coption(data, 46),
  };
}

/** Refuses data shorter than {@link APL_TOKEN_ACCOUNT_SIZE}; trailing bytes are ignored. */
export function decodeAplTokenAccount(data: Uint8Array): AplTokenAccount {
  if (data.length < APL_TOKEN_ACCOUNT_SIZE) {
    throw new MalformedAplAccountError(
      `APL token account is ${String(data.length)} bytes, expected ${String(APL_TOKEN_ACCOUNT_SIZE)}`,
    );
  }
  return {
    mint: decodePubkey(data, 0),
    owner: decodePubkey(data, 32),
    amount: decodeU64LE(data, 64),
    state: data[108] ?? 0,
  };
}
