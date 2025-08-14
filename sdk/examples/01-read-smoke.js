// examples/01-read-smoke.js
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import {
  deriveStatePda,
  deriveUserPda,
  deriveVaultAuthorityPda,
  getEmissionState,
} from "../dist/index.js";
import { readFileSync } from "fs";

const RPC_URL   = process.env.RPC_URL   ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID ?? "2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");
const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync(`${process.env.KEYPAIR ?? process.env.HOME + "/.config/solana/id.json"}`, "utf8")))
);
const connection = new Connection(RPC_URL, "confirmed");

const statePda = deriveStatePda(PROGRAM_ID);
const userPda  = deriveUserPda(PROGRAM_ID, payer.publicKey);
const vaultAuth = deriveVaultAuthorityPda(PROGRAM_ID, userPda);

console.log("Program   :", PROGRAM_ID.toBase58());
console.log("Payer     :", payer.publicKey.toBase58());
console.log("State PDA :", statePda.toBase58());
console.log("User  PDA :", userPda.toBase58());
console.log("VaultAuth :", vaultAuth.toBase58());
console.log("");

const st = await getEmissionState(connection, PROGRAM_ID);
if (!st) {
  console.warn("EmissionState not decoded by IDL (or missing).");
  process.exit(0);
}

console.log("Raw state keys:", Object.keys(st));
if (st.data && typeof st.data === "object") {
  console.log("Decoded `data` keys:", Object.keys(st.data));
}

const data = st.data ?? st;
console.log("\nEmissionState:");
console.table({
  cap: String(data.cap),
  emitted: String(data.emitted),
  base_rate_per_day: String(data.base_rate_per_day),
  annual_decay_bps: String(data.annual_decay_bps),
  throttle_target_per_user_micros: String(data.throttle_target_per_user_micros),
  clamp_min_bps: String(data.clamp_min_bps),
  clamp_max_bps: String(data.clamp_max_bps),
  last_epoch: String(data.last_epoch),
  mint: String(data.mint),
  bump: String(data.bump),
});
