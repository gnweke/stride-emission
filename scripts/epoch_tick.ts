// scripts/epoch_tick.ts
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

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")))
  );

  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID);

  const idl: any = require("../target/idl/stride_emission.json");
  const coder = new anchor.BorshInstructionCoder(idl);

  // update_epoch has no args
  const data = coder.encode("update_epoch", {});
  const keys = [{ pubkey: statePda, isSigner: false, isWritable: true }];
  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });

  const sig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(ix),
    [payer],
    { commitment: "confirmed" }
  );

  console.log("✅ Epoch tick sent. Tx:", sig);
})();
