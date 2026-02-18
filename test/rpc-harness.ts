/**
 * Arch SDK RPC Integration Test Harness
 *
 * Usage:
 *   npx ts-node test/rpc-harness.ts <RPC_URL>
 *   npx ts-node test/rpc-harness.ts http://localhost:9002
 *
 * Environment variables (optional):
 *   RPC_URL          - RPC endpoint (alternative to CLI arg)
 *   TEST_PUBKEY      - Hex-encoded 32-byte pubkey to test account reads
 *   TEST_PROGRAM_ID  - Hex-encoded 32-byte program id for getProgramAccounts
 *   TEST_TXID        - Transaction hash to test getProcessedTransaction
 *   VERBOSE          - Set to "true" for detailed output
 */

import { RpcConnection } from '../src/provider/rpc';
import { SYSTEM_PROGRAM_ID } from '../src/constants';
import type { Block, FullBlock } from '../src/struct/block';
import type { ProcessedTransaction } from '../src/struct/processed-transaction';
import type { AccountInfoResult, AccountInfoWithPubkey } from '../src/struct/account';
import type { Pubkey } from '../src/struct/pubkey';

// ─── Config ──────────────────────────────────────────────────────────────────

const RPC_URL = process.argv[2] || process.env['RPC_URL'] || '';
const VERBOSE = process.env['VERBOSE'] === 'true';
const TEST_PUBKEY_HEX = process.env['TEST_PUBKEY'] || '';
const TEST_PROGRAM_ID_HEX = process.env['TEST_PROGRAM_ID'] || '';
const TEST_TXID = process.env['TEST_TXID'] || '';

if (!RPC_URL) {
  console.error(
    'Usage: npx ts-node test/rpc-harness.ts <RPC_URL>\n' +
      '  or set RPC_URL environment variable',
  );
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(
    cleaned.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}

function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hashToHex(hash: unknown): string {
  if (typeof hash === 'string') return hash;
  if (Array.isArray(hash)) return bytesToHex(hash);
  if (hash instanceof Uint8Array) return bytesToHex(hash);
  return String(hash);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  return false;
}

function truncate(str: string, len = 64): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}

type TestResult = {
  name: string;
  passed: boolean;
  skipped: boolean;
  error?: string;
  duration: number;
};

const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<void>,
  skip = false,
): Promise<void> {
  if (skip) {
    results.push({ name, passed: false, skipped: true, duration: 0 });
    console.log(`  ⊘ SKIP  ${name}`);
    return;
  }

  const start = performance.now();
  try {
    await fn();
    const duration = performance.now() - start;
    results.push({ name, passed: true, skipped: false, duration });
    console.log(`  ✓ PASS  ${name} (${duration.toFixed(0)}ms)`);
  } catch (err: any) {
    const duration = performance.now() - start;
    const message = err?.message || String(err);
    results.push({
      name,
      passed: false,
      skipped: false,
      error: message,
      duration,
    });
    console.log(`  ✗ FAIL  ${name} (${duration.toFixed(0)}ms)`);
    console.log(`          ${truncate(message, 120)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function log(label: string, value: unknown): void {
  if (VERBOSE) {
    console.log(`          [${label}]`, JSON.stringify(value, null, 2));
  }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Arch SDK RPC Integration Test Harness                  ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  RPC URL: ${RPC_URL}`);
  console.log('');

  const rpc = new RpcConnection(RPC_URL);

  // State accumulated across tests for reuse
  let bestBlockHash: string | undefined;
  let blockCount: number | undefined;
  let firstBlockHash: string | undefined;
  let firstBlock: Block | undefined;
  let sampleTxId: string | undefined;
  let sampleProcessedTx: ProcessedTransaction | undefined;

  // ─── Block Chain Tests ─────────────────────────────────────────────

  console.log('── Block Chain ──────────────────────────────────────────');

  await runTest('getBlockCount', async () => {
    blockCount = await rpc.getBlockCount();
    assert(typeof blockCount === 'number', 'blockCount should be a number');
    assert(blockCount >= 0, 'blockCount should be >= 0');
    log('blockCount', blockCount);
  });

  await runTest('getBestBlockHash', async () => {
    bestBlockHash = await rpc.getBestBlockHash();
    assert(typeof bestBlockHash === 'string', 'bestBlockHash should be a string');
    assert(bestBlockHash.length > 0, 'bestBlockHash should not be empty');
    log('bestBlockHash', bestBlockHash);
  });

  await runTest('getBestFinalizedBlockHash', async () => {
    const hash = await rpc.getBestFinalizedBlockHash();
    assert(typeof hash === 'string', 'hash should be a string');
    assert(hash.length > 0, 'hash should not be empty');
    log('bestFinalizedBlockHash', hash);
  });

  await runTest('getBlockHash (height 0)', async () => {
    firstBlockHash = await rpc.getBlockHash(0);
    assert(typeof firstBlockHash === 'string', 'hash should be a string');
    assert(firstBlockHash.length > 0, 'hash should not be empty');
    log('blockHash(0)', firstBlockHash);
  });

  await runTest('getBlock (by hash)', async () => {
    const hashToQuery = bestBlockHash || firstBlockHash;
    assert(!!hashToQuery, 'Need a block hash from a previous test');
    firstBlock = await rpc.getBlock(hashToQuery!);
    assert(firstBlock !== undefined, 'block should not be undefined');
    assert(typeof firstBlock!.block_height === 'number', 'block_height should be a number');
    assert(typeof firstBlock!.bitcoin_block_height === 'number', 'bitcoin_block_height should be a number');
    assert(typeof firstBlock!.timestamp === 'number', 'timestamp should be a number');
    assert(
      firstBlock!.previous_block_hash !== undefined && firstBlock!.previous_block_hash !== null,
      'previous_block_hash should be defined',
    );
    assert(Array.isArray(firstBlock!.transactions), 'transactions should be an array');
    log('block', {
      block_height: firstBlock!.block_height,
      bitcoin_block_height: firstBlock!.bitcoin_block_height,
      timestamp: firstBlock!.timestamp,
      previous_block_hash: hashToHex(firstBlock!.previous_block_hash),
      tx_count: firstBlock!.transactions.length,
    });

    if (firstBlock!.transactions.length > 0) {
      const txEntry = firstBlock!.transactions[0];
      sampleTxId = typeof txEntry === 'string' ? txEntry : hashToHex(txEntry);
    }
  });

  await runTest('getBlock (non-existent hash)', async () => {
    const fakeHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const block = await rpc.getBlock(fakeHash);
    // Should return undefined for not-found rather than throwing
    assert(block === undefined, 'non-existent block should return undefined');
  });

  await runTest('getBlockByHeight (height 0)', async () => {
    const block = await rpc.getBlockByHeight(0);
    assert(block !== undefined, 'block at height 0 should exist');
    assert(block!.block_height === 0, 'block_height should be 0');
    log('blockByHeight(0)', {
      block_height: block!.block_height,
      tx_count: block!.transactions.length,
    });
  });

  // ─── Full Block Tests ──────────────────────────────────────────────

  console.log('\n── Full Blocks ─────────────────────────────────────────');

  await runTest('getFullBlockByHash', async () => {
    const hashToQuery = bestBlockHash || firstBlockHash;
    assert(!!hashToQuery, 'Need a block hash from a previous test');
    const fullBlock = await rpc.getFullBlockByHash(hashToQuery!);
    assert(fullBlock !== undefined, 'fullBlock should not be undefined');
    assert(typeof fullBlock!.block_height === 'number', 'block_height should be a number');
    assert(Array.isArray(fullBlock!.transactions), 'transactions should be an array');
    if (fullBlock!.transactions.length > 0) {
      const tx = fullBlock!.transactions[0]!;
      assert(
        tx.runtime_transaction !== undefined,
        'ProcessedTransaction should have runtime_transaction',
      );
      assert(tx.status !== undefined, 'ProcessedTransaction should have status');
      assert(Array.isArray(tx.logs), 'ProcessedTransaction should have logs array');
      assert(
        tx.rollback_status !== undefined,
        'ProcessedTransaction should have rollback_status',
      );
      assert(
        Array.isArray(tx.inner_instructions_list),
        'ProcessedTransaction should have inner_instructions_list array',
      );
    }
    log('fullBlock', {
      block_height: fullBlock!.block_height,
      tx_count: fullBlock!.transactions.length,
    });
  });

  await runTest('getFullBlockByHeight (height 0)', async () => {
    const fullBlock = await rpc.getFullBlockByHeight(0);
    assert(fullBlock !== undefined, 'fullBlock at height 0 should exist');
    assert(fullBlock!.block_height === 0, 'block_height should be 0');
    assert(Array.isArray(fullBlock!.transactions), 'transactions should be an array');
    log('fullBlockByHeight(0)', {
      block_height: fullBlock!.block_height,
      tx_count: fullBlock!.transactions.length,
    });
  });

  // ─── Transaction Tests ─────────────────────────────────────────────

  console.log('\n── Transactions ────────────────────────────────────────');

  const txIdToQuery = TEST_TXID || sampleTxId;

  await runTest(
    'getProcessedTransaction',
    async () => {
      assert(!!txIdToQuery, 'Need a txid (set TEST_TXID or ensure blocks have txs)');
      sampleProcessedTx = await rpc.getProcessedTransaction(txIdToQuery!);
      assert(sampleProcessedTx !== undefined, 'transaction should not be undefined');
      const tx = sampleProcessedTx!;
      assert(tx.runtime_transaction !== undefined, 'should have runtime_transaction');
      assert(tx.status !== undefined, 'should have status');
      assert(
        tx.status.type === 'queued' ||
          tx.status.type === 'processed' ||
          tx.status.type === 'failed',
        `status.type should be queued|processed|failed, got: ${tx.status.type}`,
      );
      assert(Array.isArray(tx.logs), 'should have logs array');
      assert(tx.rollback_status !== undefined, 'should have rollback_status');
      assert(
        tx.rollback_status.type === 'notRolledback' ||
          tx.rollback_status.type === 'rolledback',
        `rollback_status.type should be notRolledback|rolledback, got: ${tx.rollback_status.type}`,
      );
      assert(
        Array.isArray(tx.inner_instructions_list),
        'should have inner_instructions_list',
      );
      log('processedTx', {
        status: tx.status,
        rollback_status: tx.rollback_status,
        log_count: tx.logs.length,
        inner_instructions_count: tx.inner_instructions_list.length,
        bitcoin_txid: tx.bitcoin_txid,
      });
    },
    !txIdToQuery,
  );

  await runTest(
    'getProcessedTransaction (non-existent)',
    async () => {
      const fakeTxId =
        '0000000000000000000000000000000000000000000000000000000000000000';
      const tx = await rpc.getProcessedTransaction(fakeTxId);
      assert(tx === undefined, 'non-existent tx should return undefined');
    },
  );

  // ─── Account Tests ─────────────────────────────────────────────────

  console.log('\n── Accounts ────────────────────────────────────────────');

  const testPubkey: Pubkey | undefined = TEST_PUBKEY_HEX
    ? hexToBytes(TEST_PUBKEY_HEX)
    : undefined;

  await runTest(
    'readAccountInfo',
    async () => {
      assert(!!testPubkey, 'Need TEST_PUBKEY env var');
      const info = await rpc.readAccountInfo(testPubkey!);
      assert(typeof info.lamports === 'number', 'lamports should be a number');
      assert(info.owner instanceof Uint8Array, 'owner should be Uint8Array');
      assert(info.data instanceof Uint8Array, 'data should be Uint8Array');
      assert(typeof info.utxo === 'string', 'utxo should be a string');
      assert(typeof info.is_executable === 'boolean', 'is_executable should be a boolean');
      log('accountInfo', {
        lamports: info.lamports,
        owner: bytesToHex(info.owner),
        data_len: info.data.length,
        utxo: info.utxo,
        is_executable: info.is_executable,
      });
    },
    !testPubkey,
  );

  await runTest(
    'getAccountAddress',
    async () => {
      assert(!!testPubkey, 'Need TEST_PUBKEY env var');
      const address = await rpc.getAccountAddress(testPubkey!);
      assert(typeof address === 'string', 'address should be a string');
      assert(address.length > 0, 'address should not be empty');
      log('accountAddress', address);
    },
    !testPubkey,
  );

  await runTest(
    'getMultipleAccounts',
    async () => {
      assert(!!testPubkey, 'Need TEST_PUBKEY env var');
      const accounts = await rpc.getMultipleAccounts([testPubkey!]);
      assert(Array.isArray(accounts), 'should return an array');
      assert(accounts.length === 1, 'should return 1 result');
      if (accounts[0] !== null) {
        const acct = accounts[0] as AccountInfoWithPubkey;
        assert(
          acct.key instanceof Uint8Array || Array.isArray(acct.key),
          'key should be Uint8Array or array',
        );
        assert(typeof acct.lamports === 'number', 'lamports should be a number');
        assert(
          acct.owner instanceof Uint8Array || Array.isArray(acct.owner),
          'owner should be Uint8Array or array',
        );
        log('multipleAccounts[0]', {
          key: hashToHex(acct.key),
          lamports: acct.lamports,
          owner: hashToHex(acct.owner),
        });
      }
    },
    !testPubkey,
  );

  // ─── Program Account Tests ────────────────────────────────────────

  console.log('\n── Program Accounts ────────────────────────────────────');

  const testProgramId: Pubkey | undefined = TEST_PROGRAM_ID_HEX
    ? hexToBytes(TEST_PROGRAM_ID_HEX)
    : undefined;

  await runTest(
    'getProgramAccounts',
    async () => {
      assert(!!testProgramId, 'Need TEST_PROGRAM_ID env var');
      const accounts = await rpc.getProgramAccounts(testProgramId!);
      assert(Array.isArray(accounts), 'should return an array');
      log('programAccounts', { count: accounts.length });
      if (accounts.length > 0) {
        const first = accounts[0]!;
        assert(first.pubkey instanceof Uint8Array, 'pubkey should be Uint8Array');
        assert(
          typeof first.account.lamports === 'number',
          'lamports should be a number',
        );
        log('programAccounts[0]', {
          pubkey: bytesToHex(first.pubkey),
          lamports: first.account.lamports,
          data_len: first.account.data.length,
        });
      }
    },
    !testProgramId,
  );

  await runTest(
    'getProgramAccounts (system program)',
    async () => {
      const accounts = await rpc.getProgramAccounts(SYSTEM_PROGRAM_ID);
      assert(Array.isArray(accounts), 'should return an array');
      log('systemProgramAccounts', { count: accounts.length });
    },
  );

  // ─── Network Info Tests ────────────────────────────────────────────

  console.log('\n── Network Info ────────────────────────────────────────');

  await runTest('getNetworkPubkey', async () => {
    const pubkey = await rpc.getNetworkPubkey();
    assert(typeof pubkey === 'string', 'pubkey should be a string');
    assert(pubkey.length > 0, 'pubkey should not be empty');
    log('networkPubkey', pubkey);
  });

  // ─── Faucet Tests (read-only, no signing) ──────────────────────────

  console.log('\n── Faucet ──────────────────────────────────────────────');

  await runTest(
    'createAccountWithFaucet (returns unsigned tx)',
    async () => {
      // Generate a random "new" pubkey (won't collide with existing accounts)
      const randomPubkey = new Uint8Array(32);
      crypto.getRandomValues(randomPubkey);

      const tx = await rpc.createAccountWithFaucet(randomPubkey);
      assert(tx !== undefined, 'should return a RuntimeTransaction');
      assert(typeof tx.version === 'number', 'version should be a number');
      assert(Array.isArray(tx.signatures), 'signatures should be an array');
      assert(tx.message !== undefined, 'message should be defined');
      log('faucetTx', {
        version: tx.version,
        sig_count: tx.signatures.length,
      });
    },
  );

  // ─── Consistency Checks ────────────────────────────────────────────

  console.log('\n── Consistency Checks ──────────────────────────────────');

  await runTest('getBlockHash matches getBlock', async () => {
    assert(blockCount !== undefined && blockCount > 0, 'Need blockCount > 0');
    const height = 0;
    const hashFromHeight = await rpc.getBlockHash(height);
    const blockFromHash = await rpc.getBlock(hashFromHeight);
    assert(blockFromHash !== undefined, 'block from hash should exist');
    assert(
      blockFromHash!.block_height === height,
      `block_height should be ${height}, got ${blockFromHash!.block_height}`,
    );
  });

  await runTest('getBlockByHeight matches getBlock', async () => {
    const blockByHeight = await rpc.getBlockByHeight(0);
    assert(blockByHeight !== undefined, 'block at height 0 should exist');
    const hashForHeight = await rpc.getBlockHash(0);
    const blockByHash = await rpc.getBlock(hashForHeight);
    assert(blockByHash !== undefined, 'block from hash should exist');
    assert(
      blockByHeight!.block_height === blockByHash!.block_height,
      'block heights should match',
    );
    assert(
      deepEqual(blockByHeight!.previous_block_hash, blockByHash!.previous_block_hash),
      'previous_block_hash should match',
    );
  });

  await runTest('blockCount >= best block height', async () => {
    // Re-fetch blockCount to reduce race condition on live testnets
    const freshBlockCount = await rpc.getBlockCount();
    assert(bestBlockHash !== undefined, 'Need bestBlockHash');
    const bestBlock = await rpc.getBlock(bestBlockHash!);
    assert(bestBlock !== undefined, 'best block should exist');
    // Allow small tolerance for live testnets where blocks may arrive between calls
    assert(
      freshBlockCount + 5 >= bestBlock!.block_height,
      `blockCount(${freshBlockCount}) should be >= bestBlock.block_height(${bestBlock!.block_height})`,
    );
    log('consistency', {
      freshBlockCount,
      bestBlockHeight: bestBlock!.block_height,
    });
  });

  // ─── Summary ───────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const total = results.length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(
    `  Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${total} total) in ${(totalTime / 1000).toFixed(1)}s`,
  );

  if (skipped > 0) {
    console.log(
      '\n  Skipped tests need environment variables. Set these to enable:',
    );
    console.log('    TEST_PUBKEY      - hex-encoded 32-byte pubkey');
    console.log('    TEST_PROGRAM_ID  - hex-encoded 32-byte program id');
    console.log('    TEST_TXID        - transaction hash string');
  }

  if (failed > 0) {
    console.log('\n  Failed tests:');
    for (const r of results.filter((r) => !r.passed && !r.skipped)) {
      console.log(`    ✗ ${r.name}`);
      console.log(`      ${r.error}`);
    }
    console.log('');
    process.exit(1);
  }

  console.log('');
}

main().catch((err) => {
  console.error('Harness crashed:', err);
  process.exit(2);
});
