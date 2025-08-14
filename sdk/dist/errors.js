export class ProgramError extends Error {
    logs;
    constructor(msg, logs) {
        super(msg);
        this.logs = logs;
    }
}
export function extractLogs(e) {
    return e?.transactionLogs || e?.logs || (Array.isArray(e) ? e : undefined);
}
