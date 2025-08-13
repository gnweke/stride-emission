import {PublicKey} from "@solana/web3.js";
const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");

const state = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID)[0];
console.log("EmissionState PDA:", state.toBase58());
