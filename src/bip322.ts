import { mapHashToField, mod } from '@noble/curves/abstract/modular';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { concatBytes } from '@noble/hashes/utils';
import { asciiBytes, bytesToHex, hexToBytes } from './codec/bytes';
import { InvalidArgumentError } from './errors';

// The validator verifies every required signature as a BIP-322 "simple" proof over the message hash's 64 ASCII bytes,
// against the P2TR address of the signer's x-only key with no script tree (arch-network `tpu/src/processing.rs:1125-1186`,
// `sdk/src/helper/bip322.rs:162-183`); a 64-byte witness item is read as SIGHASH_DEFAULT (bip322 0.0.11
// `verify.rs:378-433`). A key the caller holds therefore signs the BIP-341 key-path sighash of BIP-322's `to_sign`, with
// the key tweaked by `hash_TapTweak` of its own x coordinate.

const { ProjectivePoint: Point, CURVE } = secp256k1;
const { bytesToNumberBE, lift_x, pointToBytes, taggedHash } = schnorr.utils;

const ZERO_U32 = new Uint8Array(4);
const ZERO_U64 = new Uint8Array(8);
const OP_1 = 0x51;
const PUSH_32 = 0x20;
const OP_RETURN = 0x6a;
/** BIP-340 key generation draws 48 bytes and reduces them into the scalar range. */
const SEED_LENGTH = 48;
const AUX_RAND_LENGTH = 32;

/** BIP-341 `t = hash_TapTweak(P)`; a tweak at or above the group order is the BIP's failure, and throws. */
function tweakOf(internalKey: Uint8Array): bigint {
  const tweak = bytesToNumberBE(taggedHash('TapTweak', internalKey));
  if (tweak >= CURVE.n) {
    throw new InvalidArgumentError(
      'TapTweak hash is not below the group order',
    );
  }
  return tweak;
}

/** The output key of a P2TR address with no script tree: `lift_x(P) + t·G` (BIP-341 `taproot_tweak_pubkey`). */
export function taprootOutputKey(internalKey: Uint8Array): Uint8Array {
  return pointToBytes(
    lift_x(bytesToNumberBE(internalKey)).add(
      Point.BASE.multiply(tweakOf(internalKey)),
    ),
  );
}

/** BIP-341 `taproot_tweak_seckey`: the secret negated to its even-y point, plus the tweak. */
function tweakedSecret(secretKey: Uint8Array): bigint {
  const secret = secp256k1.utils.normPrivateKeyToScalar(secretKey);
  const even = Point.BASE.multiply(secret).hasEvenY()
    ? secret
    : CURVE.n - secret;
  return mod(even + tweakOf(schnorr.getPublicKey(secretKey)), CURVE.n);
}

/** BIP-322 `to_spend` for a challenge script: its txid, in the byte order an outpoint serializes. */
function toSpendTxid(challenge: Uint8Array, message: Uint8Array): Uint8Array {
  const scriptSig = concatBytes(
    Uint8Array.of(0x00, PUSH_32),
    taggedHash('BIP0322-signed-message', message),
  );
  const transaction = concatBytes(
    ZERO_U32,
    Uint8Array.of(1),
    new Uint8Array(32),
    Uint8Array.of(0xff, 0xff, 0xff, 0xff),
    Uint8Array.of(scriptSig.length),
    scriptSig,
    ZERO_U32,
    Uint8Array.of(1),
    ZERO_U64,
    Uint8Array.of(challenge.length),
    challenge,
    ZERO_U32,
  );
  return sha256(sha256(transaction));
}

/**
 * The BIP-341 key-path sighash of BIP-322's `to_sign` (version 0, one input spending `to_spend:0` at sequence 0, one
 * zero-value `OP_RETURN` output, lock time 0) for the P2TR `outputKey`. `hashType` 0 is SIGHASH_DEFAULT, 1 SIGHASH_ALL.
 */
export function bip322Sighash(
  outputKey: Uint8Array,
  message: Uint8Array,
  hashType: 0 | 1 = 0,
): Uint8Array {
  const challenge = concatBytes(Uint8Array.of(OP_1, PUSH_32), outputKey);
  const sigMsg = concatBytes(
    Uint8Array.of(0x00, hashType),
    ZERO_U32,
    ZERO_U32,
    sha256(concatBytes(toSpendTxid(challenge, message), ZERO_U32)),
    sha256(ZERO_U64),
    sha256(concatBytes(Uint8Array.of(challenge.length), challenge)),
    sha256(ZERO_U32),
    sha256(concatBytes(ZERO_U64, Uint8Array.of(1, OP_RETURN))),
    Uint8Array.of(0x00),
    ZERO_U32,
  );
  return taggedHash('TapSighash', sigMsg);
}

const COMPRESSED_OR_X_ONLY = /^([0-9a-f]{64}|[0-9a-f]{66})$/;

/** The x-only key of a wallet public key in either form a BIP-322 wallet reports (optionally `0x`-prefixed); the parity byte is dropped, as the validator does. */
function xOnlyKey(publicKeyHex: string): Uint8Array {
  const trimmed = publicKeyHex.trim();
  const normalized = (
    trimmed.startsWith('0x') || trimmed.startsWith('0X')
      ? trimmed.slice(2)
      : trimmed
  ).toLowerCase();
  if (!COMPRESSED_OR_X_ONLY.test(normalized)) {
    throw new InvalidArgumentError(
      `A wallet public key is 64 or 66 hex characters, got ${String(normalized.length)}`,
    );
  }
  return hexToBytes(
    normalized.length === 66 ? normalized.slice(2) : normalized,
  );
}

/**
 * What a key that signs raw 32-byte payloads (e.g. Turnkey's `signRawPayload` with no hashing) signs for a
 * `ChallengeSigner`'s challenge: the SIGHASH_DEFAULT `to_sign` sighash for the P2TR address of `publicKeyHex`
 * (compressed or x-only), as hex. The signature must come from the key tweaked for that address, as a wallet signing
 * for its Taproot address does.
 */
export function bip322ChallengeSighash(
  publicKeyHex: string,
  challenge: string,
): string {
  const outputKey = taprootOutputKey(xOnlyKey(publicKeyHex));
  return bytesToHex(bip322Sighash(outputKey, asciiBytes(challenge)));
}

/** Signs the challenge text a transaction's message hash is (64 hex characters) and answers the 64-byte signature as hex. */
export type ChallengeSigner = (challenge: string) => Promise<string>;

export interface EphemeralSigner {
  /** The x-only key the transaction names as a required signer. */
  readonly pubkey: Uint8Array;
  readonly signer: ChallengeSigner;
}

interface CryptoHost {
  readonly crypto?: { getRandomValues(array: Uint8Array): Uint8Array };
}

/** `length` bytes from the host's CSPRNG (`crypto.getRandomValues`); `null` where the host has none. */
function randomBytes(length: number): Uint8Array | null {
  return (
    (globalThis as unknown as CryptoHost).crypto?.getRandomValues(
      new Uint8Array(length),
    ) ?? null
  );
}

/**
 * A fresh secp256k1 key from the host's CSPRNG that signs as the validator verifies; `null` where the host has none.
 * The secret lives only in the returned closure and is never serialized.
 */
export function ephemeralSigner(): EphemeralSigner | null {
  const entropy = randomBytes(SEED_LENGTH + AUX_RAND_LENGTH);
  if (entropy === null) return null;
  const secretKey = mapHashToField(entropy.subarray(0, SEED_LENGTH), CURVE.n);
  const publicKey = schnorr.getPublicKey(secretKey);
  const secret = tweakedSecret(secretKey);
  const outputKey = taprootOutputKey(publicKey);
  const auxRand = entropy.slice(SEED_LENGTH);
  return {
    pubkey: publicKey,
    signer: (challenge) =>
      Promise.resolve(
        bytesToHex(
          schnorr.sign(
            bip322Sighash(outputKey, asciiBytes(challenge)),
            secret,
            auxRand,
          ),
        ),
      ),
  };
}
