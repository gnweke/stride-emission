// sdk/src/idl.ts
import type { Idl } from "@coral-xyz/anchor";
import raw from "../../target/idl/stride_emission.json" with { type: "json" };

// Cast once here, then re-use everywhere
const idl = raw as unknown as Idl;

export default idl;
export type { Idl };
