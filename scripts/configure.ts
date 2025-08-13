// scripts/configure.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

// --- Desired params (same semantics as initialize) ---
const CAP = BigInt("121500000000000000");              // u64
const BASE_RATE_PER_DAY = BigInt("832191780821");       // u64
const ANNUAL_DECAY_BPS = 1500;                          // u16
const THROTTLE_TARGET_PER_USER_MICROS = BigInt("2000000000000"); // u64
const CLAMP_MIN_BPS = 3000;                             // u16
const CLAMP_MAX_BPS = 10000;                            // u16

// Helper to coerce based on IDL type
function toIdlValue(name: string, idlType: any) {
  // Normalize idl type to a string like "u64" | "u16"
  const t = typeof idlType === "string" ? idlType : idlType?.defined ?? idlType?.option ?? idlType?.array ?? idlType;
  const lower = String(name).toLowerCase();

  if (t === "u64") {
    if (lower.includes("cap")) return new anchor.BN(CAP.toString());
    if (lower.includes("base") || lower.includes("rate")) return new anchor.BN(BASE_RATE_PER_DAY.toString());
    if (lower.includes("micros") || lower.includes("throttle")) {
      return new anchor.BN(THROTTLE_TARGET_PER_USER_MICROS.toString());
    }
  }

  if (t === "u16") {
    if (lower.includes("decay")) return ANNUAL_DECAY_BPS;
    if (lower.includes("min")) return CLAMP_MIN_BPS;
    if (lower.includes("max")) return CLAMP_MAX_BPS;
  }

  throw new Error(`Don't know how to fill arg "${name}" of type "${t}" — update the mapper.`);
}

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(
    readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("emission_state")],
    PROGRAM_ID
  );

  const stateAi = await connection.getAccountInfo(statePda);
  if (!stateAi) {
    throw new Error(
      `EmissionState not found at ${statePda.toBase58()} — run scripts/init.ts once first.`
    );
  }

  // Load IDL and find the instruction
  const idl: any = require("../target/idl/stride_emission.json");
  const ixDef = idl.instructions.find((i: any) => i.name === "configure_emission_state");
  if (!ixDef) throw new Error("configure_emission_state not found in IDL");

  // Build args object in the *exact* order & names the IDL expects
  const argsObject: Record<string, any> = {};
  for (const a of ixDef.args) {
    argsObject[a.name] = toIdlValue(a.name, a.type);
  }

  // Log the arg names/values we’re about to send
  console.log("About to configure with:");
  for (const a of ixDef.args) {
    const v = argsObject[a.name];
    const shown =
      v instanceof anchor.BN ? v.toString() : typeof v === "bigint" ? v.toString() : v;
    console.log(`  ${a.name} (${typeof v === "object" ? "BN" : typeof v}):`, shown);
  }

  // Encode instruction data
  const coder = new anchor.BorshInstructionCoder(idl);
  const data = coder.encode("configure_emission_state", argsObject);

  // Accounts per IDL: state (mut), payer (signer)
  const keys = [
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  console.log("✅ EmissionState configured. Tx:", sig);
  console.log("STATE PDA:", statePda.toBase58());
})().catch((e) => {
  const logs = (e as any)?.transactionLogs;
  if (logs) console.error("Logs:\n" + JSON.stringify(logs, null, 2));
  console.error("❌ configure failed:", e.message || e);
});
