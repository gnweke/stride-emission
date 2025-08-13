// scripts/stake_with_transfer.ts
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
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token"; // ensured idempotent create
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

// Human amount to stake (integer in whole tokens). Example: AMOUNT=12
const AMOUNT_ENV = process.env.AMOUNT ?? "6";
const AMOUNT_HUMAN = BigInt(AMOUNT_ENV);
const DECIMALS = 6n;

// Derive ATA PDA exactly how your program/IDL expects:
// seeds = [owner, TOKEN_PROGRAM_ID, mint] under the Associated Token Program
function deriveAtaPda(owner: PublicKey, mint: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(
    readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  // ---- Program PDAs ----
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emission_state")],
    PROGRAM_ID
  );
  const [userPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), userPda.toBuffer()],
    PROGRAM_ID
  );

  // ---- Load IDL & decode state to get mint ----
  const idl: any = require("../target/idl/stride_emission.json");
  const coderIx = new anchor.BorshInstructionCoder(idl);
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  const stateAi = await connection.getAccountInfo(statePda);
  if (!stateAi) throw new Error("EmissionState missing; run scripts/init.ts first.");
  const state = coderAcc.decode("EmissionState", stateAi.data);
  const mint = new PublicKey(state.mint);

  // ---- Derive ATAs EXACTLY like the program expects ----
  const vaultAta = deriveAtaPda(vaultAuthorityPda, mint);
  const userAta  = deriveAtaPda(payer.publicKey, mint);

  // For visibility, compare with helper (should match)
  const vaultAtaHelper = getAssociatedTokenAddressSync(mint, vaultAuthorityPda, true);
  const userAtaHelper  = getAssociatedTokenAddressSync(mint, payer.publicKey, false);

  console.log("Vault Authority  :", vaultAuthorityPda.toBase58());
  console.log("Vault ATA (PDA)  :", vaultAta.toBase58());
  console.log("Vault ATA helper :", vaultAtaHelper.toBase58(), "MATCH =", vaultAtaHelper.equals(vaultAta));
  console.log("User  ATA (PDA)  :", userAta.toBase58());
  console.log("User  ATA helper :", userAtaHelper.toBase58(),  "MATCH =", userAtaHelper.equals(userAta));

  // ---- Ensure ATAs exist (idempotent create); NO client transfer ----
  const ixs: TransactionInstruction[] = [];

  // These succeed whether the account already exists or not
  ixs.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,      // payer
      userAta,              // ATA to create (or no-op if exists)
      payer.publicKey,      // owner
      mint
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      vaultAta,
      vaultAuthorityPda,    // owner is the PDA vault authority
      mint
    )
  );

  // ---- Build stake_device instruction (program will transfer tokens) ----
  const ixDef = idl.instructions.find((i: any) => i.name === "stake_device");
  if (!ixDef) throw new Error("stake_device not found in IDL");

  const raw = AMOUNT_HUMAN * (10n ** DECIMALS);

  const data = coderIx.encode("stake_device", {
    amount: new anchor.BN(raw.toString()),
  });

  const keys = ixDef.accounts.map((acc: any) => {
    const n = acc.name as string;
    if (n === "user")
      return { pubkey: userPda, isSigner: false, isWritable: true };
    if (n === "state")
      return { pubkey: statePda, isSigner: false, isWritable: true };
    if (n === "mint")
      return { pubkey: mint, isSigner: false, isWritable: false };
    if (n === "vault_authority")
      return { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false };
    if (n === "vault_ata")
      return { pubkey: vaultAta, isSigner: false, isWritable: true };
    if (n === "user_ata")
      return { pubkey: userAta, isSigner: false, isWritable: true };
    if (n === "payer")
      return { pubkey: payer.publicKey, isSigner: true, isWritable: true };
    if (n === "token_program")
      return { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false };
    if (n === "associated_token_program")
      return {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      };
    if (n === "system_program")
      return {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      };
    throw new Error(`Unmapped account '${n}' in stake_device; add a mapping if needed.`);
  });

  ixs.push(new TransactionInstruction({ programId: PROGRAM_ID, keys, data }));

  // ---- Send ----
  const tx = new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log(`✅ Staked ${AMOUNT_ENV} STRD (program transfer).`);
  console.log("Tx:", sig);
})().catch((e) => {
  const logs = (e as any)?.transactionLogs;
  if (logs) console.error("Logs:\n" + JSON.stringify(logs, null, 2));
  console.error("❌ stake_with_transfer failed:", e.message || e);
});
