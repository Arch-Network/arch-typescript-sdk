export enum Action {
  READ_ACCOUNT_INFO = 'read_account_info',
  SEND_TRANSACTION = 'send_transaction',
  SEND_TRANSACTIONS = 'send_transactions',
  GET_BLOCK = 'get_block',
  GET_BLOCK_COUNT = 'get_block_count',
  GET_BLOCK_HASH = 'get_block_hash',
  GET_BEST_BLOCK_HASH = 'get_best_block_hash',
  GET_BEST_FINALIZED_BLOCK_HASH = 'get_best_finalized_block_hash',
  GET_PROCESSED_TRANSACTION = 'get_processed_transaction',
  GET_ACCOUNT_ADDRESS = 'get_account_address',
  GET_PROGRAM_ACCOUNTS = 'get_program_accounts',
  REQUEST_AIRDROP = 'request_airdrop',
  CREATE_ACCOUNT_WITH_FAUCET = 'create_account_with_faucet',
  GET_BLOCK_BY_HEIGHT = 'get_block_by_height',
  GET_FULL_BLOCK_WITH_TXIDS = 'get_full_block_with_txids',
  GET_TRANSACTIONS_BY_BLOCK = 'get_transactions_by_block',
  GET_TRANSACTIONS_BY_IDS = 'get_transactions_by_ids',
  RECENT_TRANSACTIONS = 'recent_transactions',
  GET_MULTIPLE_ACCOUNTS = 'get_multiple_accounts',
  GET_NETWORK_PUBKEY = 'get_network_pubkey',
  CHECK_PRE_ANCHOR_CONFLICT = 'check_pre_anchor_conflict',
  GET_TRANSACTION_STATUS = 'get_transaction_status',
}

/** Serialized RuntimeTransaction size limit (Solana PACKET_DATA_SIZE). */
export const RUNTIME_TX_SIZE_LIMIT = 1232;

/** The only RuntimeTransaction.version accepted by the network. */
export const RUNTIME_TX_VERSION = 0;

export const ALLOWED_RUNTIME_TX_VERSIONS = [RUNTIME_TX_VERSION] as const;

export const MAX_TX_BATCH_SIZE = 100;

export const MAX_SIGNERS = 16;

export const MAX_TRANSACTIONS_PER_BLOCK = 1024;

// base58: "TokenT4em53UrV4gSvZ3nCS2mZeHaqTLapwt6iZt6Mk"
export const TOKEN_PROGRAM_ID = new Uint8Array([
  6, 221, 246, 225, 185, 234, 132, 65, 44, 16, 184, 223, 2, 28, 16, 15, 200,
  135, 25, 7, 195, 9, 195, 53, 53, 222, 32, 156, 52, 23, 99, 191,
]);

// base58: "ATok9pxLsNzM5zJJ3UQpXBrMriHpZiY5Yio3GKYU4we3"
export const ASSOCIATED_TOKEN_PROGRAM_ID = new Uint8Array([
  140, 151, 35, 17, 132, 146, 123, 119, 181, 241, 128, 17, 143, 204, 104, 52,
  20, 183, 124, 82, 30, 90, 119, 8, 28, 247, 29, 95, 96, 106, 83, 132,
]);

// base58: "11111111111111111111111111111111" (32 zero bytes)
export const SYSTEM_PROGRAM_ID = new Uint8Array(32);

// base58: "BpfLoader1111111111111111111111111111111111"
export const BPF_LOADER_PROGRAM_ID = new Uint8Array([
  2, 197, 178, 216, 231, 45, 42, 178, 55, 139, 51, 119, 73, 71, 125, 120, 122,
  208, 19, 239, 94, 121, 232, 49, 230, 137, 68, 140, 0, 0, 0, 0,
]);

// base58: "VoteProgram11111111111111111111111111111111"
export const VOTE_PROGRAM_ID = new Uint8Array([
  7, 97, 72, 37, 227, 237, 86, 6, 249, 190, 178, 214, 177, 8, 63, 226, 34,
  198, 130, 48, 216, 183, 167, 155, 11, 12, 86, 34, 0, 0, 0, 0,
]);

// base58: "StakeProgram1111111111111111111111111111111"
export const STAKE_PROGRAM_ID = new Uint8Array([
  6, 161, 216, 23, 183, 136, 220, 118, 238, 58, 149, 122, 111, 233, 45, 126,
  42, 165, 35, 109, 10, 154, 58, 130, 3, 20, 197, 133, 0, 0, 0, 0,
]);

// base58: "ComputeBudget111111111111111111111111111111"
export const COMPUTE_BUDGET_PROGRAM_ID = new Uint8Array([
  3, 6, 70, 111, 229, 33, 23, 50, 255, 236, 173, 186, 114, 195, 155, 231, 188,
  140, 229, 187, 197, 247, 18, 107, 44, 67, 155, 58, 64, 0, 0, 0,
]);

// base58: "NativeLoader1111111111111111111111111111111"
export const NATIVE_LOADER_PROGRAM_ID = new Uint8Array([
  5, 135, 132, 191, 20, 139, 164, 40, 47, 176, 18, 87, 72, 136, 169, 241, 83,
  160, 125, 173, 247, 101, 192, 69, 92, 154, 151, 3, 128, 0, 0, 0,
]);
