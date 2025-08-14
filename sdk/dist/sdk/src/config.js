import { Connection, PublicKey, Keypair } from "@solana/web3.js";
export function fromEnv() {
    const PROGRAM_ID = process.env.PROGRAM_ID ?? "2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw";
    const RPC = process.env.RPC ?? "http://127.0.0.1:8899";
    const cfg = {
        programId: new PublicKey(PROGRAM_ID),
        connection: new Connection(RPC, "confirmed"),
    };
    if (process.env.MINT) {
        cfg.mint = new PublicKey(process.env.MINT);
    }
    if (process.env.PAYER) {
        try {
            const arr = JSON.parse(process.env.PAYER);
            cfg.payer = Keypair.fromSecretKey(new Uint8Array(arr));
        }
        catch {
            // ignore; user can pass Signer manually
        }
    }
    return cfg;
}
