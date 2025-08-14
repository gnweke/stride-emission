import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
export declare function getEmissionState(connection: Connection, programId: PublicKey, idl?: any): Promise<{
    pubkey: anchor.web3.PublicKey;
    data: any;
} | null>;
export declare function getUserAccount(connection: Connection, programId: PublicKey, owner: PublicKey, idl?: any): Promise<{
    pubkey: anchor.web3.PublicKey;
    data: any;
} | null>;
export declare function getBalances(connection: Connection, programId: PublicKey, owner: PublicKey, mint: PublicKey, idl?: any): Promise<{
    userAta: anchor.web3.PublicKey;
    vaultAta: anchor.web3.PublicKey;
    user: bigint;
    vault: bigint;
    vaultAuthority: anchor.web3.PublicKey;
}>;
