import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
export function deriveStatePda(programId) {
    return PublicKey.findProgramAddressSync([Buffer.from("emission_state")], programId)[0];
}
export function deriveUserPda(programId, owner) {
    return PublicKey.findProgramAddressSync([Buffer.from("user"), owner.toBuffer()], programId)[0];
}
export function deriveVaultAuthorityPda(programId, userPda) {
    return PublicKey.findProgramAddressSync([Buffer.from("vault"), userPda.toBuffer()], programId)[0];
}
export function deriveAtaPda(owner, mint, ownerIsPda = false) {
    // PDAs use the same derivation; just pass the PDA as "owner".
    const [pda] = PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
    return pda;
}
