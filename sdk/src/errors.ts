export class ProgramError extends Error {
  constructor(msg: string, public logs?: string[]) {
    super(msg);
  }
}

export function extractLogs(e: any): string[] | undefined {
  return e?.transactionLogs || e?.logs || (Array.isArray(e) ? e : undefined);
}
