import { ProcessedTransaction } from './processed-transaction';

export interface Block {
  transactions: Array<string>;
  previous_block_hash: string;
  timestamp: number;
  block_height: number;
  bitcoin_block_height: number;
}

export interface FullBlock {
  transactions: Array<ProcessedTransaction>;
  previous_block_hash: string;
  timestamp: number;
  block_height: number;
  bitcoin_block_height: number;
}
