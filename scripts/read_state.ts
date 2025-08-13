// scripts/read_state.ts
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("2TadYr2dGaUV7Wi2uFZn1J6eF1Kdju9zpUzoWdTedrhw");
const DEC = 1_000_000n;

function fmt(n: bigint, d = 6) {
  const s = n.toString().padStart(d + 1, "0");
  const i = s.slice(0, -d) || "0";
  const f = s.slice(-d);
  return `${i}.${f}`;
}

(async () => {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const [statePda] = PublicKey.findProgramAddressSync([Buffer.from("emission_state")], PROGRAM_ID);

  const idl: any = require("../target/idl/stride_emission.json");
  const coderAcc = new anchor.BorshAccountsCoder(idl);

  const ai = await connection.getAccountInfo(statePda);
  if (!ai) throw new Error("EmissionState not found. Did you run init?");
  const st = coderAcc.decode("EmissionState", ai.data);

  const rows: [string, string][] = [
    ["cap_raw", String(st.cap)],
    ["cap_fmt", fmt(BigInt(st.cap))],
    ["emitted_raw", String(st.emitted)],
    ["emitted_fmt", fmt(BigInt(st.emitted))],
    ["base_rate_per_day_raw", String(st.base_rate_per_day)],
    ["base_rate_per_day_fmt", fmt(BigInt(st.base_rate_per_day))],
    ["annual_decay_bps", String(st.annual_decay_bps)],
    ["throttle_target_per_user_micros_raw", String(st.throttle_target_per_user_micros)],
    ["clamp_min_bps", String(st.clamp_min_bps)],
    ["clamp_max_bps", String(st.clamp_max_bps)],
    ["last_epoch", String(st.last_epoch)],
    ["mint", String(st.mint)],
    ["bump", String(st.bump)],
  ];

  console.log(`✅ EmissionState @ ${statePda.toBase58()}`);
  const width = Math.max(...rows.map(([k]) => k.length));
  console.table(Object.fromEntries(rows.map(([k, v]) => [k.padEnd(width, " "), v])));

  const perUserMicros = BigInt(st.throttle_target_per_user_micros);
  console.log("per-user daily target (smallest units):", (perUserMicros / 1_000_000n).toString());
  console.log("per-user daily target (STRD):", fmt(perUserMicros / 1_000_000n));
})();
