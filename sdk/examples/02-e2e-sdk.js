// examples/02-e2e-sdk.js
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  buildTickIx,
  buildClaimIxs,
  deriveUserPda,
  deriveVaultAuthorityPda,
  getEmissionState,
} from "../dist/index.js";
import {
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { readFileSync } from "fs";

const RPC_URL    = process.env.RPC_URL    ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID ?? "2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");
const payer = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync(`${process.env.KEYPAIR ?? process.env.HOME + "/.config/solana/id.json"}`, "utf8")))
);
const connection = new Connection(RPC_URL, "confirmed");

// --- helpers to print balances without relying on SDK.getBalances ---
async function readBalances(connection, programId, userPubkey, mintPk) {
  const userPda  = deriveUserPda(programId, userPubkey);
  const vaultAuth = deriveVaultAuthorityPda(programId, userPda);

  const userAta  = getAssociatedTokenAddressSync(mintPk, userPubkey, false);
  const vaultAta = getAssociatedTokenAddressSync(mintPk, vaultAuth, true);

  const userAcc  = await connection.getTokenAccountBalance(userAta).catch(()=>null);
  const vaultAcc = await connection.getTokenAccountBalance(vaultAta).catch(()=>null);

  const userBalanceRaw  = userAcc?.value?.amount ?? "0";
  const vaultBalanceRaw = vaultAcc?.value?.amount ?? "0";

  return {
    user: userPubkey.toBase58(),
    mint: mintPk.toBase58(),
    userAta: userAta.toBase58(),
    vaultAuthority: vaultAuth.toBase58(),
    vaultAta: vaultAta.toBase58(),
    userBalanceRaw,
    vaultBalanceRaw,
  };
}

// --- read state + mint ---
const st = await getEmissionState(connection, PROGRAM_ID);
if (!st || !(st.data ?? st).mint) {
  console.error("EmissionState missing/undecodable or no mint found. Re-run init+configure or copy fresh IDL.");
  process.exit(1);
}
const data = st.data ?? st;
const mint = new PublicKey(data.mint);

// BEFORE
const before = await readBalances(connection, PROGRAM_ID, payer.publicKey, mint);
console.log("Before:", before);

// 1) dev tick (advance last_epoch by 1)
const tickIx = await buildTickIx(PROGRAM_ID);
const tx1 = new Transaction().add(tickIx);
const sig1 = await sendAndConfirmTransaction(connection, tx1, [payer], { commitment: "confirmed" });
console.log("Tick tx:", sig1);

// 2) claim rewards — IMPORTANT order: (connection, programId, payer, mint)
const { preIxs, claimIx } = await buildClaimIxs(connection, PROGRAM_ID, payer.publicKey, mint);
const tx2 = new Transaction().add(...preIxs, claimIx);
const sig2 = await sendAndConfirmTransaction(connection, tx2, [payer], { commitment: "confirmed" });
console.log("Claim tx:", sig2);

// AFTER
const after = await readBalances(connection, PROGRAM_ID, payer.publicKey, mint);
console.log("After:", after);
