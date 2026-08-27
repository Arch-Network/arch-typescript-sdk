import { describe, expect, it } from 'vitest';
import {
  ALLOWED_RUNTIME_TX_VERSIONS,
  MAX_SIGNERS,
  MAX_TRANSACTIONS_PER_BLOCK,
  MAX_TX_BATCH_SIZE,
  NATIVE_LOADER_PROGRAM_ID,
  RUNTIME_TX_SIZE_LIMIT,
  RUNTIME_TX_VERSION,
} from '../constants';

describe('protocol constants match arch-network 0.8.6', () => {
  it('uses the Solana-style runtime tx size limit', () => {
    expect(RUNTIME_TX_SIZE_LIMIT).toBe(1232);
  });

  it('allows only transaction version 0', () => {
    expect(RUNTIME_TX_VERSION).toBe(0);
    expect(ALLOWED_RUNTIME_TX_VERSIONS).toEqual([0]);
  });

  it('keeps batch, signer, and block limits', () => {
    expect(MAX_TX_BATCH_SIZE).toBe(100);
    expect(MAX_SIGNERS).toBe(16);
    expect(MAX_TRANSACTIONS_PER_BLOCK).toBe(1024);
  });

  it('exports native loader id as 32 bytes', () => {
    expect(NATIVE_LOADER_PROGRAM_ID).toHaveLength(32);
  });
});
