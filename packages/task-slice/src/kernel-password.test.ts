import { describe, expect, it } from "vitest";
import { hashPasswordForKernel } from "./kernel-password.js";

describe("kernel client password hash", () => {
  it("returns a 32-byte argon2id digest that depends on username and password", async () => {
    const hash = await hashPasswordForKernel("admin", "devpassword");
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash).toHaveLength(32);
    expect(await hashPasswordForKernel("admin", "devpassword")).toEqual(hash);
    expect(await hashPasswordForKernel("admin", "other")).not.toEqual(hash);
    expect(await hashPasswordForKernel("member", "devpassword")).not.toEqual(hash);
  });
});
