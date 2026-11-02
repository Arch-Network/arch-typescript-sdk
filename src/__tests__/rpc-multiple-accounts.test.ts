import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_ACCOUNTS_BATCH_SIZE } from '../constants';
import { RpcConnection } from '../provider/rpc';

describe('RpcConnection.getMultipleAccounts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('splits inputs above MAX_ACCOUNTS_BATCH_SIZE and keeps input order', async () => {
    const pubkeys = Array.from(
      { length: MAX_ACCOUNTS_BATCH_SIZE + 50 },
      (_, i) => new Uint8Array(32).fill(i % 256),
    );

    // Behaves like the validator: rejects calls above the cap, otherwise answers
    // one account per requested key, in request order.
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const { params } = JSON.parse(init.body) as { params: number[][] };
      const body =
        params.length > MAX_ACCOUNTS_BATCH_SIZE
          ? {
              jsonrpc: '2.0',
              id: '1',
              error: { code: -32600, message: 'batch size exceeds maximum' },
            }
          : { jsonrpc: '2.0', id: '1', result: params.map((key) => ({ key })) };
      return new Response(JSON.stringify(body));
    });
    vi.stubGlobal('fetch', fetchMock);

    const accounts = await new RpcConnection('http://rpc').getMultipleAccounts(
      pubkeys,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(accounts.map((account) => account?.key)).toEqual(
      pubkeys.map((key) => Array.from(key)),
    );
  });
});
