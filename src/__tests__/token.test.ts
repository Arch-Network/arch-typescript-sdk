import { describe, expect, it } from 'vitest';

import vectors from './fixtures/program-helpers-vectors.json';
import { bytesEqual, bytesToHex, hexToBytes } from '../codec/bytes';
import { encodeU64LE } from '../codec/borsh';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '../constants';
import {
  APL_MINT_SIZE,
  APL_TOKEN_ACCOUNT_SIZE,
  MalformedAplAccountError,
  decodeAplMint,
  decodeAplTokenAccount,
} from '../token/apl';
import {
  associatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  ensureAssociatedTokenAccountInstruction,
  missingAtaInstructions,
  tokenTransferInstruction,
} from '../token/instructions';
import type { Instruction } from '../struct/instruction';

const key = (byte: number): Uint8Array => new Uint8Array(32).fill(byte);

const SENDER = key(0x11);
const SOURCE = key(0x33);
const DESTINATION = key(0x44);

function view(instruction: Instruction) {
  return {
    program_id: bytesToHex(instruction.program_id),
    accounts: instruction.accounts.map((meta) => ({
      pubkey: bytesToHex(meta.pubkey),
      is_signer: meta.is_signer,
      is_writable: meta.is_writable,
    })),
    data: bytesToHex(instruction.data),
    dataLength: instruction.data.length,
  };
}

describe('decodeAplMint', () => {
  it('reads both COption authorities, supply, decimals and the initialized flag', () => {
    const data = new Uint8Array(APL_MINT_SIZE);
    data.set([1, 0, 0, 0], 0);
    data.set(key(0xaa), 4);
    data.set(encodeU64LE(21_000_000n * 100_000_000n), 36);
    data[44] = 8;
    data[45] = 1;
    expect(decodeAplMint(data)).toEqual({
      mintAuthority: key(0xaa),
      supply: 2_100_000_000_000_000n,
      decimals: 8,
      isInitialized: true,
      freezeAuthority: null,
    });

    data.set([0, 0, 0, 0], 0);
    data.set([1, 0, 0, 0], 46);
    data.set(key(0xbb), 50);
    const swapped = decodeAplMint(data);
    expect(swapped.mintAuthority).toBeNull();
    expect(swapped.freezeAuthority).toEqual(key(0xbb));
  });

  it('refuses data shorter than a mint and ignores trailing bytes', () => {
    expect(() => decodeAplMint(new Uint8Array(APL_MINT_SIZE - 1))).toThrow(
      MalformedAplAccountError,
    );
    expect(decodeAplMint(new Uint8Array(APL_MINT_SIZE + 10)).decimals).toBe(0);
  });
});

describe('decodeAplTokenAccount', () => {
  it('reads mint, owner, amount and state', () => {
    const data = new Uint8Array(APL_TOKEN_ACCOUNT_SIZE);
    data.set(key(0x01), 0);
    data.set(key(0x02), 32);
    data.set(encodeU64LE((1n << 64n) - 1n), 64);
    data[108] = 2;
    expect(decodeAplTokenAccount(data)).toEqual({
      mint: key(0x01),
      owner: key(0x02),
      amount: (1n << 64n) - 1n,
      state: 2,
    });
  });

  it('refuses data shorter than a token account', () => {
    expect(() =>
      decodeAplTokenAccount(new Uint8Array(APL_TOKEN_ACCOUNT_SIZE - 1)),
    ).toThrow(MalformedAplAccountError);
    expect(() => decodeAplTokenAccount(new Uint8Array(0))).toThrow(
      /APL token account is 0 bytes, expected 165/,
    );
  });
});

describe('associatedTokenAddress', () => {
  it.each(vectors.ata)(
    'derives the recorded address ($id)',
    ({ owner, mint, ata }) => {
      expect(
        bytesToHex(associatedTokenAddress(hexToBytes(owner), hexToBytes(mint))),
      ).toBe(ata);
    },
  );
});

describe('createAssociatedTokenAccountInstruction', () => {
  it.each(vectors.ataCreate)(
    'matches the recorded instruction ($id)',
    ({ input, instruction }) => {
      const owner = hexToBytes(input.owner);
      const mint = hexToBytes(input.mint);
      const built = createAssociatedTokenAccountInstruction({
        payer: hexToBytes(input.payer),
        ata: associatedTokenAddress(owner, mint),
        owner,
        mint,
      });
      expect(view(built)).toEqual(instruction);
    },
  );

  it('orders funder, ATA, owner, mint, system program, token program with data [1]', () => {
    const owner = key(0x05);
    const mint = key(0x06);
    const ata = associatedTokenAddress(owner, mint);
    expect(
      createAssociatedTokenAccountInstruction({
        payer: SENDER,
        ata,
        owner,
        mint,
      }),
    ).toEqual({
      program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
      accounts: [
        { pubkey: SENDER, is_signer: true, is_writable: true },
        { pubkey: ata, is_signer: false, is_writable: true },
        { pubkey: owner, is_signer: false, is_writable: false },
        { pubkey: mint, is_signer: false, is_writable: false },
        { pubkey: SYSTEM_PROGRAM_ID, is_signer: false, is_writable: false },
        { pubkey: TOKEN_PROGRAM_ID, is_signer: false, is_writable: false },
      ],
      data: Uint8Array.of(1),
    });
  });

  it('ensureAssociatedTokenAccountInstruction is the self-funded create', () => {
    const [selfFunded] = vectors.ataCreate;
    if (selfFunded === undefined) throw new Error('missing vector');
    const { input, instruction } = selfFunded;
    expect(
      view(
        ensureAssociatedTokenAccountInstruction(
          hexToBytes(input.owner),
          hexToBytes(input.mint),
        ),
      ),
    ).toEqual(instruction);
  });
});

describe('tokenTransferInstruction', () => {
  it('encodes opcode 3 then the amount as u64 LE', () => {
    const { data } = tokenTransferInstruction(
      SOURCE,
      DESTINATION,
      SENDER,
      258n,
    );
    expect(data).toHaveLength(9);
    expect(data[0]).toBe(3);
    expect(Array.from(data.slice(1))).toEqual([0x02, 0x01, 0, 0, 0, 0, 0, 0]);
  });

  it('names the token program, and signs as the owner rather than as either account', () => {
    const instruction = tokenTransferInstruction(
      SOURCE,
      DESTINATION,
      SENDER,
      1n,
    );
    expect(instruction.program_id).toEqual(TOKEN_PROGRAM_ID);
    expect(instruction.accounts).toEqual([
      { pubkey: SOURCE, is_signer: false, is_writable: true },
      { pubkey: DESTINATION, is_signer: false, is_writable: true },
      { pubkey: SENDER, is_signer: true, is_writable: false },
    ]);
  });

  it('refuses an amount outside u64', () => {
    expect(() =>
      tokenTransferInstruction(SOURCE, DESTINATION, SENDER, 1n << 64n),
    ).toThrow(/u64 out of range/);
  });
});

describe('missingAtaInstructions', () => {
  const OWNER = key(0x05);
  const RECIPIENT = key(0x07);
  const MINT_A = key(0x0a);
  const MINT_B = key(0x0b);

  function reader(existing: readonly Uint8Array[]) {
    const asked: Uint8Array[] = [];
    return {
      asked,
      accountExists: async (pubkey: Uint8Array) => {
        asked.push(pubkey);
        return existing.some((account) => bytesEqual(account, pubkey));
      },
    };
  }

  it('creates every ATA without reading when Create is idempotent', async () => {
    const accounts = reader([associatedTokenAddress(OWNER, MINT_A)]);
    const creates = await missingAtaInstructions(accounts, {
      owner: OWNER,
      mints: [MINT_A, MINT_B],
      ataCreateIsIdempotent: true,
    });
    expect(accounts.asked).toEqual([]);
    expect(creates).toEqual([
      ensureAssociatedTokenAccountInstruction(OWNER, MINT_A),
      ensureAssociatedTokenAccountInstruction(OWNER, MINT_B),
    ]);
  });

  it('probes each ATA and creates only the absent ones, in input order, when Create is not idempotent', async () => {
    const accounts = reader([associatedTokenAddress(OWNER, MINT_A)]);
    const creates = await missingAtaInstructions(accounts, {
      owner: OWNER,
      mints: [MINT_A, MINT_B],
      ataCreateIsIdempotent: false,
    });
    expect(accounts.asked).toEqual([
      associatedTokenAddress(OWNER, MINT_A),
      associatedTokenAddress(OWNER, MINT_B),
    ]);
    expect(creates).toEqual([
      ensureAssociatedTokenAccountInstruction(OWNER, MINT_B),
    ]);
  });

  it("funds someone else's ATA from the payer, who alone signs", async () => {
    const [create] = await missingAtaInstructions(reader([]), {
      owner: RECIPIENT,
      mints: [MINT_A],
      payer: SENDER,
      ataCreateIsIdempotent: false,
    });
    expect(create).toEqual(
      createAssociatedTokenAccountInstruction({
        payer: SENDER,
        ata: associatedTokenAddress(RECIPIENT, MINT_A),
        owner: RECIPIENT,
        mint: MINT_A,
      }),
    );
  });

  it("propagates the reader's failure rather than guessing", async () => {
    const failing = {
      accountExists: () => Promise.reject(new Error('upstream down')),
    };
    await expect(
      missingAtaInstructions(failing, {
        owner: OWNER,
        mints: [MINT_A],
        ataCreateIsIdempotent: false,
      }),
    ).rejects.toThrow('upstream down');
  });
});
