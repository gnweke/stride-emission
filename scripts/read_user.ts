// scripts/read_user.ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  const [userPda]  = PublicKey.findProgramAddressSync([Buffer.from("user"), payer.publicKey.toBuffer()], PROGRAM_ID);

  const idl: any = require("../target/idl/stride_emission.json");
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  const ai = await connection.getAccountInfo(userPda);
  if (!ai) throw new Error("UserAccount not found. Run stake_init first.");

  const u = coderAcc.decode("UserAccount", ai.data);
  console.log("\nUserAccount @", userPda.toBase58());
  console.table({
    owner: String(u.owner),
    device_count: String(u.device_count),
    created_at: String(u.created_at),
    bump: String(u.bump),
  });
})();
