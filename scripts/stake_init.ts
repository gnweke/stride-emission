// scripts/stake_init.ts
import * as anchor from "@coral-xyz/anchor";
import {
  Connection, PublicKey, Keypair, SystemProgram,
  Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const secret = JSON.parse(readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));

  const idl: any = require("../target/idl/stride_emission.json");
  const coderIx = new anchor.BorshInstructionCoder(idl);
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID);
  const [userPda]  = PublicKey.findProgramAddressSync([Buffer.from("user"), payer.publicKey.toBuffer()], PROGRAM_ID);

  // Read mint from state (program wants it passed for this ix)
  const stateAi = await connection.getAccountInfo(statePda);
  if (!stateAi) throw new Error("EmissionState missing; run scripts/init.ts first.");
  const state = coderAcc.decode("EmissionState", stateAi.data);

  console.log("State PDA:", statePda.toBase58());
  console.log("User  PDA:", userPda.toBase58());
  console.log("State.mint:", String(state.mint));

  const data = coderIx.encode("stake_device_init", {}); // no args

  const keys = [
    { pubkey: userPda,               isSigner: false, isWritable: true  },
    { pubkey: statePda,              isSigner: false, isWritable: false },
    { pubkey: new PublicKey(state.mint), isSigner: false, isWritable: false },
    { pubkey: payer.publicKey,       isSigner: true,  isWritable: true  },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
  const sig = await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer], {
    commitment: "confirmed",
  });

  console.log("✅ UserAccount created @", userPda.toBase58(), "Tx:", sig);
})();
