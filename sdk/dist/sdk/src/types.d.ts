import type { Connection, PublicKey, Signer } from "@solana/web3.js";
export type SdkConfig = {
    connection: Connection;
    programId: PublicKey;
    mint?: PublicKey;
    payer?: Signer;
    idl?: any;
};
export type StakeAmount = {
    raw: bigint;
} | {
    human: bigint;
};
export type TxSig = string;
