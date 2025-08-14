import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import idlDefault from "./idl.js";
import { deriveAtaPda, deriveStatePda, deriveUserPda, deriveVaultAuthorityPda } from "./pdas.js";
import { ProgramError, extractLogs } from "./errors.js";
function coder(idl) {
    return {
        ix: new anchor.BorshInstructionCoder(idl),
        acc: new anchor.BorshAccountsCoder(idl),
    };
}
export async function buildInitStateIx(connection, programId, payer, mint, args, idl = idlDefault) {
    const { ix } = coder(idl);
    const statePda = deriveStatePda(programId);
    const data = ix.encode("initialize_emission_state", args);
    const keys = [
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId, keys, data });
}
export async function buildConfigureIx(programId, payer, args, idl = idlDefault) {
    const { ix } = coder(idl);
    const statePda = deriveStatePda(programId);
    const data = ix.encode("configure_emission_state", args);
    const keys = [
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false },
    ];
    return new TransactionInstruction({ programId, keys, data });
}
export function buildStakeInitIx(programId, payer, mint, idl = idlDefault) {
    const { ix } = coder(idl);
    const statePda = deriveStatePda(programId);
    const userPda = deriveUserPda(programId, payer);
    const data = ix.encode("stake_device_init", {});
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId, keys, data });
}
export async function buildStakeIxs(connection, programId, payer, mint, amount, idl = idlDefault) {
    const { ix, acc } = coder(idl);
    const statePda = deriveStatePda(programId);
    const userPda = deriveUserPda(programId, payer);
    const vaultAuth = deriveVaultAuthorityPda(programId, userPda);
    // derive ATAs
    const userAta = getAssociatedTokenAddressSync(mint, payer, false);
    const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuth, true);
    // idempotent create (safe if already exists)
    const preIxs = [
        createAssociatedTokenAccountIdempotentInstruction(payer, userAta, payer, mint),
        createAssociatedTokenAccountIdempotentInstruction(payer, vaultAta, vaultAuth, mint),
    ];
    const dec = 6n;
    const raw = "raw" in amount
        ? amount.raw
        : (amount.human * (10n ** dec));
    const data = ix.encode("stake_device", { amount: new anchor.BN(raw.toString()) });
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    const stakeIx = new TransactionInstruction({ programId, keys, data });
    return { preIxs, stakeIx };
}
export function buildUnstakeIx(programId, payer, mint, amountRaw, // base units
idl = idlDefault) {
    const { ix } = coder(idl);
    const statePda = deriveStatePda(programId);
    const userPda = deriveUserPda(programId, payer);
    const vaultAuth = deriveVaultAuthorityPda(programId, userPda);
    const vaultAta = deriveAtaPda(vaultAuth, mint);
    const userAta = deriveAtaPda(payer, mint);
    const data = ix.encode("unstake_device", { amount: new anchor.BN(amountRaw.toString()) });
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: vaultAuth, isSigner: false, isWritable: false },
        { pubkey: vaultAta, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({ programId, keys, data });
}
export async function buildClaimIxs(connection, programId, payer, mint, idl = idlDefault) {
    const { ix } = coder(idl);
    const statePda = deriveStatePda(programId);
    const userPda = deriveUserPda(programId, payer);
    const userAta = getAssociatedTokenAddressSync(mint, payer, false);
    // ensure user ATA exists first-time
    const preIxs = [];
    const ai = await connection.getAccountInfo(userAta);
    if (!ai) {
        preIxs.push(createAssociatedTokenAccountInstruction(payer, userAta, payer, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID));
    }
    // IMPORTANT: mint is writable
    const data = ix.encode("claim_rewards", {});
    const keys = [
        { pubkey: userPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: userAta, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    const claimIx = new TransactionInstruction({ programId, keys, data });
    return { preIxs, claimIx };
}
export function buildTickIx(programId) {
    const statePda = deriveStatePda(programId);
    const data = new anchor.BorshInstructionCoder(idlDefault).encode("update_epoch", {});
    const keys = [{ pubkey: statePda, isSigner: false, isWritable: true }];
    return new TransactionInstruction({ programId, keys, data });
}
/** Convenience “send” wrappers (optional use) */
export async function sendTx(connection, payer, ixs) {
    try {
        const tx = new Transaction().add(...ixs);
        return await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
    }
    catch (e) {
        throw new ProgramError(e.message ?? "sendTx failed", extractLogs(e));
    }
}
