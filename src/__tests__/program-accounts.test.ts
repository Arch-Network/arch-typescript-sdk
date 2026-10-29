import { afterEach, describe, expect, it, vi } from 'vitest';
import { RpcConnection } from '../provider/rpc';
import type { ProgramAccountFilter } from '../struct/program-account';

function answering(result: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(JSON.stringify({ jsonrpc: '2.0', id: 'curlycurl', result })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RpcConnection.getProgramAccounts', () => {
  it('sends DataContent bytes as a number array', async () => {
    const fetchMock = answering([]);
    const program = new Uint8Array(32).fill(7);

    await new RpcConnection('http://node').getProgramAccounts(program, [
      { DataSize: 165 },
      { DataContent: { offset: 32, bytes: Uint8Array.of(1, 2, 3) } },
    ]);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(init?.body as string);
    expect(body.params).toEqual([
      Array.from(program),
      [{ DataSize: 165 }, { DataContent: { offset: 32, bytes: [1, 2, 3] } }],
    ]);
  });

  it('sends a ProgramAccountFilter unchanged, alongside an AccountFilter', async () => {
    const fetchMock = answering([]);
    const program = new Uint8Array(32).fill(7);
    const filters: readonly ProgramAccountFilter[] = Object.freeze([
      { DataSize: 165 },
      { DataContent: { offset: 32, bytes: [4, 5] } },
    ]);

    await new RpcConnection('http://node').getProgramAccounts(program, [
      ...filters,
      { DataContent: { offset: 0, bytes: Uint8Array.of(6) } },
    ]);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(init?.body as string);
    expect(body.params).toEqual([
      Array.from(program),
      [
        { DataSize: 165 },
        { DataContent: { offset: 32, bytes: [4, 5] } },
        { DataContent: { offset: 0, bytes: [6] } },
      ],
    ]);
  });

  it('returns an empty list when no account matches', async () => {
    answering([]);
    const accounts = await new RpcConnection('http://node').getProgramAccounts(
      new Uint8Array(32),
    );
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts).toEqual([]);
  });

  it('decodes matching accounts with byte fields', async () => {
    answering([
      {
        pubkey: [9, 9],
        account: { lamports: 5, owner: [1], data: [4, 5], utxo: 'u', is_executable: false },
      },
    ]);
    const accounts = await new RpcConnection('http://node').getProgramAccounts(
      new Uint8Array(32),
    );
    expect(accounts).toEqual([
      {
        pubkey: Uint8Array.of(9, 9),
        account: { lamports: 5, owner: Uint8Array.of(1), data: Uint8Array.of(4, 5), utxo: 'u', is_executable: false },
      },
    ]);
  });
});
