import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/** Safe-cast: accept a base58 string or a PublicKey */
export function asPubkey(k: PublicKey | string): PublicKey {
  return k instanceof PublicKey ? k : new PublicKey(k);
}

export function deriveStatePda(programId: PublicKey | string): PublicKey {
  const pid = asPubkey(programId);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emission_state")],
    pid
  );
  return pda;
}

export function deriveUserPda(
  programId: PublicKey | string,
  owner: PublicKey | string
): PublicKey {
  const pid = asPubkey(programId);
  const ow = asPubkey(owner);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), ow.toBuffer()],
    pid
  );
  return pda;
}

export function deriveVaultAuthorityPda(
  programId: PublicKey | string,
  userPda: PublicKey | string
): PublicKey {
  const pid = asPubkey(programId);
  const up = asPubkey(userPda);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), up.toBuffer()],
    pid
  );
  return pda;
}

export function deriveAtaPda(
  owner: PublicKey | string,
  mint: PublicKey | string
): PublicKey {
  const ow = asPubkey(owner);
  const mi = asPubkey(mint);
  const [pda] = PublicKey.findProgramAddressSync(
    [ow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mi.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}
