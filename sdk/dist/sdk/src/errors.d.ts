export declare class ProgramError extends Error {
    logs?: string[] | undefined;
    constructor(msg: string, logs?: string[] | undefined);
}
export declare function extractLogs(e: any): string[] | undefined;
