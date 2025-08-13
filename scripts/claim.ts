// scripts/claim.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey(
  "2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw"
);

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(
    readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  // ---- PDAs ----
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emission_state")],
    PROGRAM_ID
  );
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );

  // ---- Load IDL & decoders ----
  const idl: any = require("../target/idl/stride_emission.json");
  const coderIx = new anchor.BorshInstructionCoder(idl);
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  // ---- Fetch state to get mint ----
  const stateAi = await connection.getAccountInfo(statePda);
  if (!stateAi) {
    throw new Error(
      "EmissionState not found. Run scripts/init.ts then scripts/configure.ts"
    );
  }
  const state = coderAcc.decode("EmissionState", stateAi.data);
  const mint = new PublicKey(state.mint);

  // ---- Derive user ATA for the mint ----
  const userAta = getAssociatedTokenAddressSync(mint, payer.publicKey, false);

  // ---- Ensure user ATA exists (create if missing) ----
  const preIxs: TransactionInstruction[] = [];
  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    preIxs.push(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        userAta,
        payer.publicKey,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // ---- Build claim_rewards ix from IDL ----
  const ixDef = idl.instructions.find((i: any) => i.name === "claim_rewards");
  if (!ixDef) throw new Error("claim_rewards not found in IDL");

  const data = coderIx.encode("claim_rewards", {}); // no args

  // IMPORTANT: mark accounts exactly as the program expects.
  const keys = ixDef.accounts.map((acc: any) => {
    const n = acc.name as string;
    if (n === "user")
      return { pubkey: userPda, isSigner: false, isWritable: true };
    if (n === "state")
      return { pubkey: statePda, isSigner: false, isWritable: true };
    if (n === "mint")
      // <-- MUST be writable (supply changes on mint_to)
      return { pubkey: mint, isSigner: false, isWritable: true };
    if (n === "user_ata")
      return { pubkey: userAta, isSigner: false, isWritable: true };
    if (n === "payer")
      return { pubkey: payer.publicKey, isSigner: true, isWritable: true };
    if (n === "token_program")
      return { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false };
    if (n === "system_program")
      return {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      };
    throw new Error(`Unmapped account '${n}' in claim_rewards`);
  });

  const claimIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction().add(...preIxs, claimIx);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log("✅ Claimed rewards. Tx:", sig);
})().catch((e) => {
  const logs = (e as any)?.transactionLogs;
  if (logs) console.error("Logs:\n" + JSON.stringify(logs, null, 2));
  console.error("❌ Claim failed:", e.message || e);
});
