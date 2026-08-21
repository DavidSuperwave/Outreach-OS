/** Portable hex/base64 helpers matching kernel User DO (`user.ts` session token encoding). */

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const toBase64 = (bytes as { toBase64?: () => string }).toBase64;
  if (typeof toBase64 === "function") return toBase64.call(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function bytesFromBase64(encoded: string): Uint8Array {
  const fromBase64 = (Uint8Array as unknown as { fromBase64?: (value: string) => Uint8Array })
    .fromBase64;
  if (typeof fromBase64 === "function") return fromBase64(encoded);
  const binary = atob(encoded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Constant-time compare — same loop as workshop-backend `bytesEqual`. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length != b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
