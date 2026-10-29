import { bytesToHex } from './codec/bytes';

export interface DecodedProgramError {
  readonly code: number;
  readonly name: string;
  /** The message the program's IDL publishes for the code. */
  readonly message?: string;
}

export interface ProgramErrorTable {
  readonly errors: ReadonlyMap<number, DecodedProgramError>;
  /** A program whose contract maps inner-CPI failures onto its own codes decodes even when logs exist; others decode only empty-log failures. */
  readonly decodesWithLogs: boolean;
}

/** Keyed by the lowercase hex program id. */
export type ProgramErrorTables = ReadonlyMap<string, ProgramErrorTable>;

/** One entry of a program IDL's `errors` array. */
export interface IdlErrorEntry {
  readonly code: number;
  readonly name: string;
  readonly msg?: string;
}

/**
 * The fields of a `ProcessedTransaction` the decoder reads. `ProcessedTransaction` satisfies it; so does a caller's own
 * readonly wire type.
 */
export interface ProgramErrorSource {
  readonly runtime_transaction: {
    readonly message: {
      readonly account_keys: readonly Uint8Array[];
      readonly instructions: readonly { readonly program_id_index: number }[];
    };
  };
  readonly status: { readonly type: string; readonly message?: string };
  readonly logs: readonly string[];
}

/** A program's table from its IDL `errors` entries. */
export function programErrorTable(
  errors: readonly IdlErrorEntry[],
  options: { readonly decodesWithLogs: boolean },
): ProgramErrorTable {
  const entries = new Map<number, DecodedProgramError>();
  for (const { code, name, msg } of errors)
    entries.set(
      code,
      msg === undefined ? { code, name } : { code, name, message: msg },
    );
  return { errors: entries, decodesWithLogs: options.decodesWithLogs };
}

/** `Error processing Instruction 0, error: custom program error: 0x4` */
const FAILURE_PATTERN =
  /error processing instruction (\d+).*?custom program error: (0x[0-9a-f]+)/i;

/** `Program log: AnchorError ... Error Code: ConstraintAddress. Error Number: 2012. Error Message: An address constraint was violated.` */
const SATELLITE_ERROR_LOG_PATTERN =
  /AnchorError .*?Error Code:\s*([A-Za-z0-9_]+)\.\s*Error Number:\s*(\d+)\.\s*Error Message:\s*(.+)$/i;

// Framework errors are absent from every program IDL; this no-logs fallback covers the address constraint CLAMM SwapV2 raises.
const SATELLITE_FRAMEWORK_ERRORS: ReadonlyMap<number, DecodedProgramError> =
  new Map([
    [
      2012,
      {
        code: 2012,
        name: 'ConstraintAddress',
        message: 'An address constraint was violated',
      },
    ],
  ]);

function loggedSatelliteError(
  logs: readonly string[],
  expectedCode: number,
): DecodedProgramError | null {
  for (const log of logs) {
    const match = SATELLITE_ERROR_LOG_PATTERN.exec(log);
    if (match === null) continue;
    const [, name = '', number = '', text = ''] = match;
    const code = Number(number);
    if (code !== expectedCode) continue;
    return { code, name, message: text.replace(/\.\s*$/, '') };
  }
  return null;
}

/**
 * Names the `custom program error: 0xN` behind a failed status, using the table of the failing instruction's program.
 * `null` when the status is not a failure, the message carries no custom code, the instruction or program is unknown, or
 * the table has no entry. A matching `AnchorError` log line wins over the table.
 */
export function decodeProgramError(
  tx: ProgramErrorSource | null,
  tables: ProgramErrorTables,
): DecodedProgramError | null {
  if (
    tx === null ||
    tx.status.type.toLowerCase() !== 'failed' ||
    tx.status.message === undefined
  )
    return null;
  const match = FAILURE_PATTERN.exec(tx.status.message);
  if (match === null) return null;
  const [, instructionText = '', codeText = ''] = match;

  const code = Number.parseInt(codeText, 16);
  const { account_keys, instructions } = tx.runtime_transaction.message;
  const instruction = instructions[Number(instructionText)];
  if (instruction === undefined) return null;
  const programKey = account_keys[instruction.program_id_index];
  if (programKey === undefined) return null;

  const table = tables.get(bytesToHex(programKey));
  if (table === undefined) return null;

  // A structured AnchorError log is authoritative even when an inner CPI produced it.
  const logged = loggedSatelliteError(tx.logs, code);
  if (logged !== null) return logged;
  const framework = SATELLITE_FRAMEWORK_ERRORS.get(code);
  if (framework !== undefined) return framework;

  // With logs present the raw code may belong to an inner CPI program, which the caller's table cannot name.
  if (tx.logs.length > 0 && !table.decodesWithLogs) return null;
  return table.errors.get(code) ?? null;
}
