import * as anchor from "@coral-xyz/anchor";
import { deriveStatePda, deriveUserPda, deriveVaultAuthorityPda, deriveAtaPda } from "./pdas.js";
import idlDefault from "./idl.js";
export async function getEmissionState(connection, programId, idl = idlDefault) {
    const coderAcc = new anchor.BorshAccountsCoder(idl);
    const statePda = deriveStatePda(programId);
    const ai = await connection.getAccountInfo(statePda);
    if (!ai)
        return null;
    const st = coderAcc.decode("EmissionState", ai.data);
    return { pubkey: statePda, data: st };
}
export async function getUserAccount(connection, programId, owner, idl = idlDefault) {
    const coderAcc = new anchor.BorshAccountsCoder(idl);
    const userPda = deriveUserPda(programId, owner);
    const ai = await connection.getAccountInfo(userPda);
    if (!ai)
        return null;
    const u = coderAcc.decode("UserAccount", ai.data);
    return { pubkey: userPda, data: u };
}
export async function getBalances(connection, programId, owner, mint, idl = idlDefault) {
    const userPda = deriveUserPda(programId, owner);
    const vaultAuthority = deriveVaultAuthorityPda(programId, userPda);
    const userAta = deriveAtaPda(owner, mint);
    const vaultAta = deriveAtaPda(vaultAuthority, mint);
    const [userAcc, vaultAcc] = await Promise.all([
        connection.getTokenAccountBalance(userAta).catch(() => null),
        connection.getTokenAccountBalance(vaultAta).catch(() => null),
    ]);
    const user = userAcc?.value?.amount ? BigInt(userAcc.value.amount) : 0n;
    const vault = vaultAcc?.value?.amount ? BigInt(vaultAcc.value.amount) : 0n;
    return { userAta, vaultAta, user, vault, vaultAuthority };
}
