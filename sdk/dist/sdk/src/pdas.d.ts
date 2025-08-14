import { PublicKey } from "@solana/web3.js";
export declare function deriveStatePda(programId: PublicKey): PublicKey;
export declare function deriveUserPda(programId: PublicKey, owner: PublicKey): PublicKey;
export declare function deriveVaultAuthorityPda(programId: PublicKey, userPda: PublicKey): PublicKey;
export declare function deriveAtaPda(owner: PublicKey, mint: PublicKey, ownerIsPda?: boolean): PublicKey;
