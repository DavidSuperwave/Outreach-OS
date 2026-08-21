import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  N1_KERNEL_SURFACE,
  N1_KERNEL_SURFACE_COUNT,
  SERVICE_SALT,
} from "./kernel-auth-surface.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const apiTs = readFileSync(
  join(root, "cloudflare-os/packages/workshop-shared/src/api.ts"),
  "utf8",
);
const ledger = readFileSync(
  join(root, "docs/neuwave-rewrite/reports/02-rpc-compatibility-ledger.csv"),
  "utf8",
);

describe("N1 kernel auth surface (28 frozen rows)", () => {
  it("lists exactly 28 PublicApi + LoginAttempt + AdminApi + ConnectedAccountsSubscriber rows", () => {
    expect(N1_KERNEL_SURFACE).toHaveLength(N1_KERNEL_SURFACE_COUNT);
    const byIface = Object.fromEntries(
      ["PublicApi", "LoginAttempt", "AdminApi", "ConnectedAccountsSubscriber"].map((iface) => [
        iface,
        N1_KERNEL_SURFACE.filter((row) => row.iface === iface).length,
      ]),
    );
    expect(byIface).toEqual({
      PublicApi: 8,
      LoginAttempt: 1,
      AdminApi: 16,
      ConnectedAccountsSubscriber: 3,
    });
  });

  it("every row exists in the 182-row ledger and in pinned api.ts", () => {
    for (const row of N1_KERNEL_SURFACE) {
      expect(ledger).toContain(`${row.iface},${row.method},`);
      if (row.method === "wait") {
        expect(apiTs).toMatch(/wait\(\):\s*Promise<string>/);
      } else {
        expect(apiTs).toContain(`${row.method}(`);
      }
    }
  });

  it("freezes SERVICE_SALT bytes from api.ts (login/createAccount hash contract)", () => {
    expect([...SERVICE_SALT]).toEqual([
      0xd9, 0x4e, 0x54, 0x1d, 0x29, 0xc1, 0x03, 0x74, 0x73, 0x7e, 0xb3, 0xe3, 0x34, 0x6d, 0x8f, 0x21,
    ]);
    expect(apiTs).toContain("export const SERVICE_SALT");
  });

  it("marks authenticateFromCfAccess as OD-12b keep-but-disabled, not removed", () => {
    const row = N1_KERNEL_SURFACE.find((item) => item.method === "authenticateFromCfAccess");
    expect(row?.needsReview).toMatch(/OD-12b/);
    expect(apiTs).toContain("authenticateFromCfAccess()");
  });
});
