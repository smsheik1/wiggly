import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { openSync, closeSync, readFileSync, writeFileSync, fstatSync, constants } from "node:fs";
import { join } from "node:path";
export type SignedOperatorCommand<T> = { payload: T; signature: string };
export type OperatorPayload = { id: string; principal: string; project_id: string; action: string };

// The local OS operator owns this capability. It is outside every worker mount.
// No worker receives signing tools, the key, or unrestricted shell access.
function authority(root: string) {
  const fd = openSync(join(root, "operator-auth.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.uid !== process.geteuid!()) throw new Error("OPERATOR_AUTH_FILE_DENIED");
    const value = JSON.parse(readFileSync(fd, "utf8"));
    if (value.principal !== `local-operator-${process.geteuid!()}` || typeof value.key !== "string" || Buffer.from(value.key, "base64").length !== 32) throw new Error("OPERATOR_AUTH_FILE_INVALID");
    return value as { principal: string; key: string };
  } finally { closeSync(fd); }
}
export function provisionLocalOperator(root: string): string {
  try { writeFileSync(join(root, "operator-auth.json"), JSON.stringify({ principal: `local-operator-${process.geteuid!()}`, key: randomBytes(32).toString("base64") }), { mode: 0o600, flag: "wx" }); }
  catch (error: any) { if (error.code !== "EEXIST") throw error; }
  return authority(root).principal;
}
export function commandJSON(value: unknown): string {
  // Canonical field ordering makes signed command delivery independent of JSON key order.
  function ordered(v: any): any { if (Array.isArray(v)) return v.map(ordered); if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, ordered(v[k])])); return v; }
  const serialized = JSON.stringify(ordered(value));
  if (!serialized || Buffer.byteLength(serialized) > 65536) throw new Error("INVALID_OPERATOR_COMMAND");
  return serialized;
}
export function signLocalOperator<T extends OperatorPayload>(root: string, payload: T): SignedOperatorCommand<T> {
  const auth = authority(root); if (payload.principal !== auth.principal) throw new Error("OPERATOR_PRINCIPAL_DENIED");
  return { payload, signature: createHmac("sha256", Buffer.from(auth.key, "base64")).update(commandJSON(payload)).digest("hex") };
}
export function authenticateOperator<T extends OperatorPayload>(root: string, command: SignedOperatorCommand<T>): T {
  const auth = authority(root);
  if (!command?.payload || command.payload.principal !== auth.principal || typeof command.signature !== "string" || !/^[a-f0-9]{64}$/.test(command.signature)) throw new Error("UNAUTHENTICATED_OPERATOR");
  const expected = createHmac("sha256", Buffer.from(auth.key, "base64")).update(commandJSON(command.payload)).digest();
  if (!timingSafeEqual(expected, Buffer.from(command.signature, "hex"))) throw new Error("UNAUTHENTICATED_OPERATOR");
  return command.payload;
}
