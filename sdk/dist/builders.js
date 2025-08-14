import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction, } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createAssociatedTokenAccountInstruction, } from "@solana/spl-token";
import idlDefault from "./idl.js";
import { asPubkey, deriveAtaPda, deriveStatePda, deriveUserPda, deriveVaultAuthorityPda, } from "./pdas.js";
import { ProgramError, extractLogs } from "./errors.js";
function coder(idl) {
    return {
        ix: new anchor.BorshInstructionCoder(idl),
        acc: new anchor.BorshAccountsCoder(idl),
    };
}
export async function buildInitStateIx(connection, programId, payer, mint, args, idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const MINT = asPubkey(mint);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const data = ix.encode("initialize_emission_state", args);
    const keys = [
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: MINT, isSigner: false, isWritable: true },
        { pubkey: PAYER, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId: PID, keys, data });
}
export async function buildConfigureIx(programId, payer, args, idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const data = ix.encode("configure_emission_state", args);
    const keys = [
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: PAYER, isSigner: true, isWritable: false },
    ];
    return new TransactionInstruction({ programId: PID, keys, data });
}
export function buildStakeInitIx(programId, payer, mint, idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const MINT = asPubkey(mint);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const userPda = deriveUserPda(PID, PAYER);
    const data = ix.encode("stake_device_init", {});
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: false },
        { pubkey: MINT, isSigner: false, isWritable: false },
        { pubkey: PAYER, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId: PID, keys, data });
}
export async function buildStakeIxs(connection, programId, payer, mint, amount, idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const MINT = asPubkey(mint);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const userPda = deriveUserPda(PID, PAYER);
    const vaultAuth = deriveVaultAuthorityPda(PID, userPda);
    // ATAs
    const userAta = getAssociatedTokenAddressSync(MINT, PAYER, false);
    const vaultAta = getAssociatedTokenAddressSync(MINT, vaultAuth, true);
    // idempotent create
    const preIxs = [
        createAssociatedTokenAccountIdempotentInstruction(PAYER, userAta, PAYER, MINT),
        createAssociatedTokenAccountIdempotentInstruction(PAYER, vaultAta, vaultAuth, MINT),
    ];
    const dec = 6n;
    const raw = "raw" in amount ? amount.raw : amount.human * (10n ** dec);
    const data = ix.encode("stake_device", {
        amount: new anchor.BN(raw.toString()),
    });
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: MINT, isSigner: false, isWritable: false },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: PAYER, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    const stakeIx = new TransactionInstruction({ programId: PID, keys, data });
    return { preIxs, stakeIx };
}
export function buildUnstakeIx(programId, payer, mint, amountRaw, // base units
idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const MINT = asPubkey(mint);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const userPda = deriveUserPda(PID, PAYER);
    const vaultAuth = deriveVaultAuthorityPda(PID, userPda);
    const vaultAta = deriveAtaPda(vaultAuth, MINT);
    const userAta = deriveAtaPda(PAYER, MINT);
    const data = ix.encode("unstake_device", {
        amount: new anchor.BN(amountRaw.toString()),
    });
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: MINT, isSigner: false, isWritable: false },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: PAYER, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId: PID, keys, data });
}
export async function buildClaimIxs(connection, programId, payer, mint, idl = idlDefault) {
    const PID = asPubkey(programId);
    const PAYER = asPubkey(payer);
    const MINT = asPubkey(mint);
    const { ix } = coder(idl);
    const statePda = deriveStatePda(PID);
    const userPda = deriveUserPda(PID, PAYER);
    const userAta = getAssociatedTokenAddressSync(MINT, PAYER, false);
    // ensure ATA
    const preIxs = [];
    const ai = await connection.getAccountInfo(userAta);
    if (!ai) {
        preIxs.push(createAssociatedTokenAccountInstruction(PAYER, userAta, PAYER, MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
    }
    // mint must be writable
    const data = ix.encode("claim_rewards", {});
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: MINT, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: PAYER, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    const claimIx = new TransactionInstruction({ programId: PID, keys, data });
    return { preIxs, claimIx };
}
export function buildTickIx(programId) {
    const PID = asPubkey(programId);
    const statePda = deriveStatePda(PID);
    const data = new anchor.BorshInstructionCoder(idlDefault).encode("update_epoch", {});
    const keys = [{ pubkey: statePda, isSigner: false, isWritable: true }];
    return new TransactionInstruction({ programId: PID, keys, data });
}
/** Convenience “send” wrappers (optional use) */
export async function sendTx(connection, payer, ixs) {
    try {
        const tx = new Transaction().add(...ixs);
        return await sendAndConfirmTransaction(connection, tx, [payer], {
            commitment: "confirmed",
        });
    }
    catch (e) {
        throw new ProgramError(e.message ?? "sendTx failed", extractLogs(e));
    }
}
