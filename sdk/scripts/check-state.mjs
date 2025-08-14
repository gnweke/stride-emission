
import { Connection, PublicKey } from '@solana/web3.js';

const rpc = process.env.RPC_URL ?? 'http://127.0.0.1:8899';

const c = new Connection(rpc, 'confirmed');

const p = new PublicKey('3sYbvhedE9S1QFQpfui2fxKiYudn99CvnPUgEWxYqm27');

const ai = await c.getAccountInfo(p);

console.log({ exists: !!ai, owner: ai?.owner?.toBase58() });

