import { describe, expect, it } from 'vitest';

import { hexToBytes } from '../codec/bytes';
import {
  decodeProgramError,
  programErrorTable,
  type DecodedProgramError,
  type ProgramErrorTables,
} from '../program-error';
import type { ProcessedTransaction } from '../struct/processed-transaction';

const PROPAMM = 'aa'.repeat(32);
const CLAMM = 'bb'.repeat(32);
const LENDING = 'cc'.repeat(32);
const UNKNOWN = 'dd'.repeat(32);

const QUOTE_EXPIRED: DecodedProgramError = {
  code: 4,
  name: 'QuoteExpired',
  message: 'Quote has expired',
};
const CONSTRAINT_ADDRESS: DecodedProgramError = {
  code: 2012,
  name: 'ConstraintAddress',
  message: 'An address constraint was violated',
};

const TABLES: ProgramErrorTables = new Map([
  [
    PROPAMM,
    {
      decodesWithLogs: true,
      errors: new Map([
        [0, { code: 0, name: 'QuoteSignerAccountNotSigner' }],
        [4, QUOTE_EXPIRED],
      ]),
    },
  ],
  [
    CLAMM,
    {
      decodesWithLogs: false,
      errors: new Map([
        [
          6017,
          {
            code: 6017,
            name: 'TokenMaxExceeded',
            message: 'Exceeded token max',
          },
        ],
      ]),
    },
  ],
  [
    LENDING,
    {
      decodesWithLogs: false,
      errors: new Map([
        [7008, { code: 7008, name: 'MaxUtilisationRateReached' }],
      ]),
    },
  ],
]);

const CUSTOM_0X4 =
  'Error processing Instruction 0, error: custom program error: 0x4';
const ANCHOR_LOG =
  'Program log: AnchorError caused by account: x. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.';

interface TxShape {
  programs?: readonly string[];
  status?: { type: string; message?: string };
  logs?: string[];
  programIdIndex?: number;
}

function tx({
  programs = [PROPAMM],
  status = { type: 'failed', message: CUSTOM_0X4 },
  logs = [],
  programIdIndex,
}: TxShape = {}): ProcessedTransaction {
  return {
    runtime_transaction: {
      version: 0,
      signatures: [],
      message: {
        header: {
          num_required_signatures: 1,
          num_readonly_signed_accounts: 0,
          num_readonly_unsigned_accounts: 0,
        },
        account_keys: [new Uint8Array(32), ...programs.map(hexToBytes)],
        recent_blockhash: new Uint8Array(32),
        instructions: programs.map((_, i) => ({
          program_id_index: programIdIndex ?? i + 1,
          accounts: [0],
          data: new Uint8Array(0),
        })),
      },
    },
    status: status as ProcessedTransaction['status'],
    bitcoin_txid: null,
    logs,
    rollback_status: { type: 'notRolledback' },
    inner_instructions_list: [],
  };
}

describe('decodeProgramError', () => {
  it('decodes a table hit and returns null for a miss', () => {
    expect(decodeProgramError(tx(), TABLES)).toEqual(QUOTE_EXPIRED);
    expect(
      decodeProgramError(
        tx({
          status: { type: 'failed', message: CUSTOM_0X4.replace('0x4', '0x0') },
        }),
        TABLES,
      ),
    ).toEqual({ code: 0, name: 'QuoteSignerAccountNotSigner' });
    expect(
      decodeProgramError(
        tx({
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('0x4', '0x999'),
          },
        }),
        TABLES,
      ),
    ).toBeNull();
  });

  it('requires a failed status, case-insensitively', () => {
    expect(decodeProgramError(null, TABLES)).toBeNull();
    expect(
      decodeProgramError(
        tx({ status: { type: 'Failed', message: CUSTOM_0X4 } }),
        TABLES,
      ),
    ).toEqual(QUOTE_EXPIRED);
    expect(
      decodeProgramError(
        tx({ status: { type: 'processed', message: CUSTOM_0X4 } }),
        TABLES,
      ),
    ).toBeNull();
    expect(
      decodeProgramError(tx({ status: { type: 'failed' } }), TABLES),
    ).toBeNull();
  });

  it('matches the failure pattern on one line, through the node stage prefix', () => {
    expect(
      decodeProgramError(
        tx({
          status: { type: 'failed', message: 'Insufficient lamports for fees' },
        }),
        TABLES,
      ),
    ).toBeNull();
    expect(
      decodeProgramError(
        tx({
          status: {
            type: 'failed',
            message:
              'Error processing Instruction 0,\nerror: custom program error: 0x4',
          },
        }),
        TABLES,
      ),
    ).toBeNull();
    expect(
      decodeProgramError(
        tx({
          status: {
            type: 'failed',
            message: `post_processing: failed to process transaction: ${CUSTOM_0X4}`,
          },
        }),
        TABLES,
      ),
    ).toEqual(QUOTE_EXPIRED);
  });

  it('resolves the program through the instruction index and program_id_index', () => {
    const second = tx({
      programs: [UNKNOWN, PROPAMM],
      status: {
        type: 'failed',
        message: CUSTOM_0X4.replace('Instruction 0', 'Instruction 1'),
      },
    });
    expect(decodeProgramError(second, TABLES)).toEqual(QUOTE_EXPIRED);
    expect(
      decodeProgramError(tx({ programs: [UNKNOWN, PROPAMM] }), TABLES),
    ).toBeNull();
    expect(
      decodeProgramError(
        tx({
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('Instruction 0', 'Instruction 3'),
          },
        }),
        TABLES,
      ),
    ).toBeNull();
    expect(decodeProgramError(tx({ programIdIndex: 7 }), TABLES)).toBeNull();
    expect(decodeProgramError(tx({ programs: [UNKNOWN] }), TABLES)).toBeNull();
  });

  it('prefers a matching AnchorError log, stripping only the trailing period', () => {
    const message = CUSTOM_0X4.replace('0x4', '0xbc4');
    expect(
      decodeProgramError(
        tx({
          programs: [CLAMM],
          status: { type: 'failed', message },
          logs: [ANCHOR_LOG],
        }),
        TABLES,
      ),
    ).toEqual({
      code: 3012,
      name: 'AccountNotInitialized',
      message: 'The program expected this account to be already initialized',
    });
    const innerPeriods = ANCHOR_LOG.replace(
      'AccountNotInitialized',
      'ConstraintAddress',
    )
      .replace('3012', '2012')
      .replace(/Error Message: .*$/, 'Error Message: Foo. Bar.');
    expect(
      decodeProgramError(
        tx({
          programs: [CLAMM],
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('0x4', '0x7dc'),
          },
          logs: [innerPeriods],
        }),
        TABLES,
      ),
    ).toEqual({
      code: 2012,
      name: 'ConstraintAddress',
      message: 'Foo. Bar',
    });
  });

  it('falls through a mismatching AnchorError log to the framework table', () => {
    const message = CUSTOM_0X4.replace('0x4', '0x7dc');
    expect(
      decodeProgramError(
        tx({
          programs: [CLAMM],
          status: { type: 'failed', message },
          logs: [ANCHOR_LOG],
        }),
        TABLES,
      ),
    ).toEqual(CONSTRAINT_ADDRESS);
    expect(
      decodeProgramError(
        tx({ programs: [CLAMM], status: { type: 'failed', message } }),
        TABLES,
      ),
    ).toEqual(CONSTRAINT_ADDRESS);
  });

  it('decodes with logs only when the table says so', () => {
    expect(
      decodeProgramError(tx({ logs: ['Program log: QuoteExpired'] }), TABLES),
    ).toEqual(QUOTE_EXPIRED);
    const clamm = CUSTOM_0X4.replace('0x4', '0x1781');
    expect(
      decodeProgramError(
        tx({
          programs: [CLAMM],
          status: { type: 'failed', message: clamm },
          logs: ['Program log: TokenMaxExceeded'],
        }),
        TABLES,
      ),
    ).toBeNull();
    expect(
      decodeProgramError(
        tx({ programs: [CLAMM], status: { type: 'failed', message: clamm } }),
        TABLES,
      ),
    ).toEqual({
      code: 6017,
      name: 'TokenMaxExceeded',
      message: 'Exceeded token max',
    });
  });

  it('parses mixed-case hex and misses on a code above 2^32', () => {
    expect(
      decodeProgramError(
        tx({
          programs: [LENDING],
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('0x4', '0x1B60'),
          },
        }),
        TABLES,
      ),
    ).toEqual({ code: 7008, name: 'MaxUtilisationRateReached' });
    expect(
      decodeProgramError(
        tx({
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('0x4', '0xffffffffff'),
          },
        }),
        TABLES,
      ),
    ).toBeNull();
  });

  it('accepts a readonly wire-shaped transaction, not only ProcessedTransaction', () => {
    const wire = {
      runtime_transaction: {
        message: {
          account_keys: [new Uint8Array(32), hexToBytes(PROPAMM)] as const,
          instructions: [{ program_id_index: 1 }] as const,
        },
      },
      status: { type: 'failed', message: CUSTOM_0X4 },
      logs: [] as readonly string[],
    } as const;
    expect(decodeProgramError(wire, TABLES)).toEqual(QUOTE_EXPIRED);
  });
});

describe('decodeProgramError without tables', () => {
  it('returns null for every failure, whether or not the logs or an AnchorError line name it', () => {
    const none: ProgramErrorTables = new Map();
    expect(decodeProgramError(tx(), none)).toBeNull();
    expect(
      decodeProgramError(tx({ logs: ['Program log: QuoteExpired'] }), none),
    ).toBeNull();
    expect(
      decodeProgramError(
        tx({
          programs: [CLAMM],
          status: {
            type: 'failed',
            message: CUSTOM_0X4.replace('0x4', '0x7dc'),
          },
          logs: [ANCHOR_LOG],
        }),
        none,
      ),
    ).toBeNull();
  });
});

describe('programErrorTable', () => {
  it("builds a program's table from its IDL entries, mapping msg to message and omitting it when absent", () => {
    const table = programErrorTable(
      [
        { code: 4, name: 'QuoteExpired', msg: 'Quote has expired' },
        { code: 8, name: 'NonceReplay' },
      ],
      { decodesWithLogs: true },
    );

    expect(table.decodesWithLogs).toBe(true);
    expect([...table.errors.entries()]).toEqual([
      [4, { code: 4, name: 'QuoteExpired', message: 'Quote has expired' }],
      [8, { code: 8, name: 'NonceReplay' }],
    ]);
    expect(decodeProgramError(tx(), new Map([[PROPAMM, table]]))).toEqual(
      QUOTE_EXPIRED,
    );
    expect(
      decodeProgramError(
        tx({ logs: ['Program log: x'] }),
        new Map([
          [
            PROPAMM,
            programErrorTable([{ code: 4, name: 'QuoteExpired' }], {
              decodesWithLogs: false,
            }),
          ],
        ]),
      ),
    ).toBeNull();
  });
});
