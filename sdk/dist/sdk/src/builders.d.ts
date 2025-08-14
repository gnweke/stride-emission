import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Signer, TransactionInstruction } from "@solana/web3.js";
import { StakeAmount, TxSig } from "./types.js";
export declare function buildInitStateIx(connection: Connection, programId: PublicKey, payer: PublicKey, mint: PublicKey, args: {
    cap: anchor.BN;
    baseRatePerDay: anchor.BN;
    annualDecayBps: number;
    throttleTargetPerUserMicros: anchor.BN;
    clampMinBps: number;
    clampMaxBps: number;
}, idl?: any): Promise<anchor.web3.TransactionInstruction>;
export declare function buildConfigureIx(programId: PublicKey, payer: PublicKey, args: {
    cap: anchor.BN;
    baseRatePerDay: anchor.BN;
    annualDecayBps: number;
    throttleTargetPerUserMicros: anchor.BN;
    clampMinBps: number;
    clampMaxBps: number;
}, idl?: any): Promise<anchor.web3.TransactionInstruction>;
export declare function buildStakeInitIx(programId: PublicKey, payer: PublicKey, mint: PublicKey, idl?: any): anchor.web3.TransactionInstruction;
export declare function buildStakeIxs(connection: Connection, programId: PublicKey, payer: PublicKey, mint: PublicKey, amount: StakeAmount, idl?: any): Promise<{
    preIxs: anchor.web3.TransactionInstruction[];
    stakeIx: anchor.web3.TransactionInstruction;
}>;
export declare function buildUnstakeIx(programId: PublicKey, payer: PublicKey, mint: PublicKey, amountRaw: bigint, // base units
idl?: any): anchor.web3.TransactionInstruction;
export declare function buildClaimIxs(connection: Connection, programId: PublicKey, payer: PublicKey, mint: PublicKey, idl?: any): Promise<{
    preIxs: anchor.web3.TransactionInstruction[];
    claimIx: anchor.web3.TransactionInstruction;
}>;
export declare function buildTickIx(programId: PublicKey): anchor.web3.TransactionInstruction;
/** Convenience “send” wrappers (optional use) */
export declare function sendTx(connection: Connection, payer: Signer, ixs: TransactionInstruction[]): Promise<TxSig>;
