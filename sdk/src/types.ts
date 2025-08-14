import type { Connection, PublicKey, Signer } from "@solana/web3.js";

export type SdkConfig = {
  connection: Connection;
  programId: PublicKey;
  mint?: PublicKey; // optional: read from state if not provided
  payer?: Signer;   // for .send() helpers; optional for pure builders
  idl?: any;        // pass preloaded IDL; otherwise we'll load from ../target/idl
};

export type StakeAmount =
  | { raw: bigint }        // in base units (10^6)
  | { human: bigint };     // whole tokens (decimals = 6)

export type TxSig = string;
