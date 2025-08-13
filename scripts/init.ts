// scripts/init.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PROGRAM_ID = new PublicKey(
  "2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw"
);

// ---- Emission params (same as before; tweak if needed) ----
const CAP = BigInt("121500000000000000");              // total cap (base units)
const BASE_RATE_PER_DAY = BigInt("832191780821");       // example value
const ANNUAL_DECAY_BPS = 1500;                          // 15.00%
const THROTTLE_TARGET_PER_USER_MICROS = BigInt("2000000000000"); // 2 * 1e12 micros
const CLAMP_MIN_BPS = 3000;                             // 30%
const CLAMP_MAX_BPS = 10000;                            // 100%

(async () => {
  const mintStr = process.env.MINT;
  if (!mintStr) {
    throw new Error(
      "Missing MINT env var. Example:\nMINT=<your_mint_pubkey> npx ts-node scripts/init.ts"
    );
  }
  const mint = new PublicKey(mintStr);

  // connection + payer
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(
    readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  // derive state PDA
  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emission_state")],
    PROGRAM_ID
  );

  // sanity: ensure mint is a *real* SPL Token mint (owned by Token Program)
  const ai = await connection.getAccountInfo(mint);
  if (!ai) {
    throw new Error(
      `Mint account ${mint.toBase58()} not found. Create it with 'spl-token create-token --decimals 6'.`
    );
  }
  if (!ai.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error(
      `Mint ${mint.toBase58()} is owned by ${ai.owner.toBase58()}, expected ${TOKEN_PROGRAM_ID.toBase58()} (SPL Token program).`
    );
  }

  // build instruction from IDL
  const idl: any = require("../target/idl/stride_emission.json");
  const coder = new anchor.BorshInstructionCoder(idl);

  const data = coder.encode("initialize_emission_state", {
    cap: new anchor.BN(CAP.toString()),
    baseRatePerDay: new anchor.BN(BASE_RATE_PER_DAY.toString()),
    annualDecayBps: ANNUAL_DECAY_BPS,
    throttleTargetPerUserMicros: new anchor.BN(
      THROTTLE_TARGET_PER_USER_MICROS.toString()
    ),
    clampMinBps: CLAMP_MIN_BPS,
    clampMaxBps: CLAMP_MAX_BPS,
  });

  // account metas must match the IDL order
  // initialize_emission_state accounts:
  //  state (init, seeds=[b"emission_state"]), mint (mut), payer (signer, mut), system_program
  const keys = [
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log("✅ EmissionState initialized. Tx:", sig);
  console.log("STATE PDA:", statePda.toBase58());
  console.log("MINT     :", mint.toBase58());
})().catch((e) => {
  const logs = (e as any)?.transactionLogs;
  if (logs) console.error("Logs:\n" + JSON.stringify(logs, null, 2));
  console.error("❌ init failed:", e.message || e);
});
