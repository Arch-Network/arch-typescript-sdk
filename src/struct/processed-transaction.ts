import { RuntimeTransaction } from './runtime-transaction';
import { SanitizedInstruction } from './sanitized-instruction';

export type ProcessedTransactionStatus =
  | {
      type: 'queued';
    }
  | {
      type: 'processed';
    }
  | {
      type: 'failed';
      message: string;
    };

export type RollbackStatus =
  | {
      type: 'notRolledback';
    }
  | {
      type: 'rolledback';
      message: string;
    };

export interface InnerInstruction {
  instruction: SanitizedInstruction;
  stack_height: number;
}

export type InnerInstructions = InnerInstruction[];

export type InnerInstructionsList = InnerInstructions[];

export interface ProcessedTransaction {
  runtime_transaction: RuntimeTransaction;
  status: ProcessedTransactionStatus;
  bitcoin_txid: string | null;
  logs: Array<string>;
  rollback_status: RollbackStatus;
  inner_instructions_list: InnerInstructionsList;
}
