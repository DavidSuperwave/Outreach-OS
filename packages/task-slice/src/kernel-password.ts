import { SERVICE_SALT } from "@gadgets/workshop-shared/api";

/**
 * Client password hash for kernel PublicApi.login / createAccount (api.ts @ bf7f762).
 * argon2id(password, salt = SERVICE_SALT + utf8(username), ...).
 */
export async function hashPasswordForKernel(username: string, password: string): Promise<Uint8Array> {
  const { argon2id } = await import("hash-wasm");
  const usernameBuf = new TextEncoder().encode(username.toLowerCase());
  const salt = new Uint8Array(SERVICE_SALT.length + usernameBuf.length);
  salt.set(SERVICE_SALT);
  salt.set(usernameBuf, SERVICE_SALT.length);
  return argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: "binary",
  });
}
