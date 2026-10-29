import { mod } from '@noble/curves/abstract/modular';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bip322ChallengeSighash,
  bip322Sighash,
  ephemeralSigner,
  taprootOutputKey,
} from '../bip322';
import { asciiBytes, bytesToHex, hexToBytes } from '../codec/bytes';
import { InvalidArgumentError } from '../errors';

// BIP-322's own taproot vector: the key behind WIF `L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k`, the witness
// program of `bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3`, and the SIGHASH_ALL signature of
// "Hello World" (`AUHd69Pr…AQ==` with its witness framing and trailing sighash byte removed).
const SECRET = hexToBytes(
  'bb051cd0dda0246f33c5a9e133ebd8e7bc02a92af6c41adc131ccd7826c5b004',
);
const OUTPUT_KEY = hexToBytes(
  '0b34f2cc6f60d54e3fdc2d1dd053fcc393bd2db9acc8de4a7c3cc28a83d4d8e9',
);
const SIGNATURE_ALL = hexToBytes(
  'ddebd3eb25012ffa82937d9f25f9644e047bb2f472ab6c5089bbb53588ada2884cb5bcc53911f32d8dcf9548733b694d120db6a4e485194559e8d8fe668d269f',
);

const { ProjectivePoint: Point, CURVE } = secp256k1;
const { bytesToNumberBE, numberToBytesBE, taggedHash } = schnorr.utils;

function evenSecret(secretKey: Uint8Array): bigint {
  const secret = bytesToNumberBE(secretKey);
  return Point.BASE.multiply(secret).hasEvenY() ? secret : CURVE.n - secret;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BIP-322 over a P2TR key path', () => {
  it("tweaks the vector's key to its address's output key", () => {
    expect(taprootOutputKey(schnorr.getPublicKey(SECRET))).toEqual(OUTPUT_KEY);
  });

  it("verifies the vector's signature over the sighash of to_sign, and refuses it for another message", () => {
    expect(
      schnorr.verify(
        SIGNATURE_ALL,
        bip322Sighash(OUTPUT_KEY, asciiBytes('Hello World'), 1),
        OUTPUT_KEY,
      ),
    ).toBe(true);
    expect(
      schnorr.verify(
        SIGNATURE_ALL,
        bip322Sighash(OUTPUT_KEY, asciiBytes('Hello World'), 0),
        OUTPUT_KEY,
      ),
    ).toBe(false);
    expect(
      schnorr.verify(
        SIGNATURE_ALL,
        bip322Sighash(
          OUTPUT_KEY,
          asciiBytes('Hello World -- This should fail'),
          1,
        ),
        OUTPUT_KEY,
      ),
    ).toBe(false);
  });

  it('signs a challenge with a fresh key as the validator verifies it: 64 bytes, SIGHASH_DEFAULT, the tweaked key', async () => {
    const first = ephemeralSigner();
    const second = ephemeralSigner();
    if (first === null || second === null) {
      throw new Error('the test host has a CSPRNG');
    }
    expect(first.pubkey).toHaveLength(32);
    expect(first.pubkey).not.toEqual(second.pubkey);
    const challenge = 'ab'.repeat(32);
    const signature = hexToBytes(await first.signer(challenge));
    expect(signature).toHaveLength(64);
    const outputKey = taprootOutputKey(first.pubkey);
    expect(
      schnorr.verify(
        signature,
        bip322Sighash(outputKey, asciiBytes(challenge)),
        outputKey,
      ),
    ).toBe(true);
    expect(
      schnorr.verify(
        signature,
        bip322Sighash(outputKey, asciiBytes('cd'.repeat(32))),
        outputKey,
      ),
    ).toBe(false);
    expect(
      schnorr.verify(
        signature,
        bip322Sighash(first.pubkey, asciiBytes(challenge)),
        first.pubkey,
      ),
    ).toBe(false);
  });

  it('offers no key on a host without a CSPRNG', () => {
    vi.stubGlobal('crypto', undefined);
    expect(ephemeralSigner()).toBeNull();
  });
});

describe('bip322ChallengeSighash', () => {
  it("is the SIGHASH_DEFAULT sighash for the key's own address, from the x-only key or either parity of the compressed one", () => {
    const expected = bytesToHex(
      bip322Sighash(OUTPUT_KEY, asciiBytes('ab'.repeat(32))),
    );
    const compressed = secp256k1.getPublicKey(SECRET, true);
    // The negated secret's point shares the x coordinate under the other parity byte, as BIP-340 reads it.
    const negated = secp256k1.getPublicKey(
      numberToBytesBE(CURVE.n - bytesToNumberBE(SECRET), 32),
      true,
    );
    expect([compressed[0], negated[0]].sort()).toEqual([2, 3]);
    for (const key of [schnorr.getPublicKey(SECRET), compressed, negated]) {
      expect(bip322ChallengeSighash(bytesToHex(key), 'ab'.repeat(32))).toBe(
        expected,
      );
    }
  });

  it("is what the key tweaked for its address signs and the validator's check accepts", () => {
    const challenge = 'cd'.repeat(32);
    const tweak = taggedHash('TapTweak', schnorr.getPublicKey(SECRET));
    const secret = mod(evenSecret(SECRET) + bytesToNumberBE(tweak), CURVE.n);
    const signature = schnorr.sign(
      hexToBytes(
        bip322ChallengeSighash(
          bytesToHex(schnorr.getPublicKey(SECRET)),
          challenge,
        ),
      ),
      secret,
    );
    expect(
      schnorr.verify(
        signature,
        bip322Sighash(OUTPUT_KEY, asciiBytes(challenge)),
        OUTPUT_KEY,
      ),
    ).toBe(true);
  });

  it('accepts a 0x prefix and refuses a key of any other length', () => {
    const xOnly = bytesToHex(schnorr.getPublicKey(SECRET));
    const challenge = 'ab'.repeat(32);
    expect(bip322ChallengeSighash(`0x${xOnly}`, challenge)).toBe(
      bip322ChallengeSighash(xOnly, challenge),
    );
    expect(() => bip322ChallengeSighash(xOnly.slice(2), challenge)).toThrow(
      InvalidArgumentError,
    );
  });
});
