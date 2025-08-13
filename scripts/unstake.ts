// scripts/unstake.ts
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
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

function deriveAtaPda(owner: PublicKey, mint: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  // PDAs
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID);
  const [userPda]  = PublicKey.findProgramAddressSync([Buffer.from("user"), payer.publicKey.toBuffer()], PROGRAM_ID);
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), userPda.toBuffer()], PROGRAM_ID);

  // Load IDL
  const idl: any = require("../target/idl/stride_emission.json");
  const coderIx  = new anchor.BorshInstructionCoder(idl);
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  // Read state to get mint
  const stateAi = await connection.getAccountInfo(statePda);
  if (!stateAi) throw new Error("EmissionState missing; run scripts/init.ts first.");
  const state = coderAcc.decode("EmissionState", stateAi.data);
  const mint = new PublicKey(state.mint);

  // ATAs
  const vaultAta = deriveAtaPda(vaultAuthorityPda, mint);
  const userAta  = deriveAtaPda(payer.publicKey, mint);

  // Determine amount
  const want = (process.env.AMOUNT ?? "").trim();
  let amountRaw: bigint;

  // Fetch current vault balance to help
  const va = await getAccount(connection, vaultAta).catch(() => null);
  const vaultBalanceRaw = va ? BigInt(va.amount.toString()) : 0n;

  if (!want || want.toUpperCase() === "ALL") {
    amountRaw = vaultBalanceRaw; // take everything
  } else {
    // decimals = 6
    const DECIMALS = 6n;
    const human = BigInt(want);
    amountRaw = human * (10n ** DECIMALS);
  }

  if (amountRaw <= 0n) {
    console.log("Vault balance (raw):", vaultBalanceRaw.toString());
    throw new Error("Unstake amount must be > 0. Provide AMOUNT=<number> or use AMOUNT=ALL.");
  }
  if (amountRaw > vaultBalanceRaw) {
    throw new Error(`Unstake amount (${amountRaw}) exceeds vault balance (${vaultBalanceRaw}). Try a smaller AMOUNT or AMOUNT=ALL.`);
  }

  console.log("Unstaking raw amount:", amountRaw.toString());

  // Build ix per IDL
  const ixDef = idl.instructions.find((i: any) => i.name === "unstake_device");
  if (!ixDef) throw new Error("unstake_device not found in IDL");

  const data = coderIx.encode("unstake_device", { amount: new anchor.BN(amountRaw.toString()) });

  const keys = ixDef.accounts.map((acc: any) => {
    const n = acc.name as string;
    if (n === "user")                    return { pubkey: userPda,           isSigner: false, isWritable: true  };
    if (n === "state")                   return { pubkey: statePda,          isSigner: false, isWritable: true  };
    if (n === "mint")                    return { pubkey: mint,              isSigner: false, isWritable: false };
    if (n === "vault_authority")         return { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false };
    if (n === "vault_ata")               return { pubkey: vaultAta,          isSigner: false, isWritable: true  };
    if (n === "user_ata")                return { pubkey: userAta,           isSigner: false, isWritable: true  };
    if (n === "payer")                   return { pubkey: payer.publicKey,   isSigner: true,  isWritable: true  };
    if (n === "token_program")           return { pubkey: TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false };
    if (n === "associated_token_program")
                                         return { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false };
    if (n === "system_program")          return { pubkey: SystemProgram.programId, isSigner: false, isWritable: false };
    throw new Error(`Unmapped account '${n}' in unstake_device; add a mapping if needed.`);
  });

  const tx = new Transaction().add(new TransactionInstruction({ programId: PROGRAM_ID, keys, data }));
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });

  console.log("✅ Unstaked. Tx:", sig);
})().catch((e) => {
  const logs = (e as any)?.transactionLogs;
  if (logs) console.error("Logs:\n" + JSON.stringify(logs, null, 2));
  console.error("❌ Unstake failed:", e.message || e);
});
