import { encodeU64LE } from '../codec/borsh';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../constants';
import { getAssociatedTokenAddress } from '../serde/pubkey';
import { Instruction } from '../struct/instruction';
import { Pubkey } from '../struct/pubkey';

/** The owner's associated token account for `mint` under the runtime token programs; off-curve (PDA) owners allowed. */
export function associatedTokenAddress(owner: Pubkey, mint: Pubkey): Pubkey {
  return getAssociatedTokenAddress(
    mint,
    owner,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** The associated-token program's `Create` with data `[1]`: funder, ATA, owner, mint, system program, token program. */
export function createAssociatedTokenAccountInstruction(params: {
  readonly payer: Pubkey;
  readonly ata: Pubkey;
  readonly owner: Pubkey;
  readonly mint: Pubkey;
}): Instruction {
  return {
    program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
    accounts: [
      { pubkey: params.payer, is_signer: true, is_writable: true },
      { pubkey: params.ata, is_signer: false, is_writable: true },
      { pubkey: params.owner, is_signer: false, is_writable: false },
      { pubkey: params.mint, is_signer: false, is_writable: false },
      { pubkey: SYSTEM_PROGRAM_ID, is_signer: false, is_writable: false },
      { pubkey: TOKEN_PROGRAM_ID, is_signer: false, is_writable: false },
    ],
    data: Uint8Array.of(1),
  };
}

/** `Create` for the owner's own ATA of `mint`, funded by the owner. */
export function ensureAssociatedTokenAccountInstruction(
  owner: Pubkey,
  mint: Pubkey,
): Instruction {
  return createAssociatedTokenAccountInstruction({
    payer: owner,
    ata: associatedTokenAddress(owner, mint),
    owner,
    mint,
  });
}

/** The APL token program's `Transfer`: opcode 3 then the amount as u64 LE. Accounts: source, destination, owner (signer). */
export function tokenTransferInstruction(
  source: Pubkey,
  destination: Pubkey,
  owner: Pubkey,
  amount: bigint,
): Instruction {
  const data = new Uint8Array(9);
  data[0] = 3;
  data.set(encodeU64LE(amount), 1);
  return {
    program_id: TOKEN_PROGRAM_ID,
    accounts: [
      { pubkey: source, is_signer: false, is_writable: true },
      { pubkey: destination, is_signer: false, is_writable: true },
      { pubkey: owner, is_signer: true, is_writable: false },
    ],
    data,
  };
}

/**
 * Whether an account exists. Answer `false` for the upstream's not-found response and let any other failure throw: a
 * wrong guess either omits a required `Create` (`AccountNotInitialized`) or emits one a non-idempotent program rejects.
 */
export interface AccountExistenceReader {
  accountExists(pubkey: Pubkey): Promise<boolean>;
}

export interface MissingAtaInput {
  readonly owner: Pubkey;
  readonly mints: readonly Pubkey[];
  /** Who funds the accounts. Defaults to the owner; a transfer to someone else's address pays for theirs, and they sign nothing. */
  readonly payer?: Pubkey;
  /** The network's associated-token program semantics (deployment data): an idempotent `Create` is its own existence check; otherwise each ATA is probed first. */
  readonly ataCreateIsIdempotent: boolean;
}

/** `Create` instructions to prepend for the owner's ATAs of `mints`, in input order; `reader` is consulted only when `Create` is not idempotent. */
export async function missingAtaInstructions(
  reader: AccountExistenceReader,
  input: MissingAtaInput,
): Promise<Instruction[]> {
  const { owner, mints, ataCreateIsIdempotent } = input;
  const payer = input.payer ?? owner;
  const atas = mints.map((mint) => associatedTokenAddress(owner, mint));
  const create = (i: number): Instruction =>
    createAssociatedTokenAccountInstruction({
      payer,
      ata: atas[i]!,
      owner,
      mint: mints[i]!,
    });
  if (ataCreateIsIdempotent) return mints.map((_, i) => create(i));
  const exists = await Promise.all(
    atas.map((ata) => reader.accountExists(ata)),
  );
  return mints.flatMap((_, i) => (exists[i] === true ? [] : [create(i)]));
}
