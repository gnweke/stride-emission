// scripts/read_balances.ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");
const DEC = 1_000_000n;

function fmt(n: bigint) {
  const s = n.toString().padStart(7, "0");
  return `${s.slice(0, -6)}.${s.slice(-6)}`;
}

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID);
  const [userPda]  = PublicKey.findProgramAddressSync([Buffer.from("user"), payer.publicKey.toBuffer()], PROGRAM_ID);
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), userPda.toBuffer()], PROGRAM_ID);

  const idl: any = require("../target/idl/stride_emission.json");
  const coderAcc = new anchor.BorshAccountsCoder(idl);
  const ai = await connection.getAccountInfo(statePda);
  if (!ai) throw new Error("EmissionState not found.");
  const st = coderAcc.decode("EmissionState", ai.data);
  const mint = new PublicKey(st.mint);

  const userAta  = getAssociatedTokenAddressSync(mint, payer.publicKey, false);
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultAuthorityPda, true);

  const userAcc  = await connection.getTokenAccountBalance(userAta).catch(()=>null);
  const vaultAcc = await connection.getTokenAccountBalance(vaultAta).catch(()=>null);

  const userBal  = userAcc?.value?.amount ? BigInt(userAcc.value.amount) : 0n;
  const vaultBal = vaultAcc?.value?.amount ? BigInt(vaultAcc.value.amount) : 0n;

  console.table({
    user_pubkey: payer.publicKey.toBase58(),
    user_ata: userAta.toBase58(),
    user_balance_raw: userBal.toString(),
    user_balance_fmt: fmt(userBal),
    vault_authority_pda: vaultAuthorityPda.toBase58(),
    vault_ata: vaultAta.toBase58(),
    vault_balance_raw: vaultBal.toString(),
    vault_balance_fmt: fmt(vaultBal),
  });
})();
