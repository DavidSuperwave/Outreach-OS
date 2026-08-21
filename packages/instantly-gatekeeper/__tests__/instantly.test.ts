import { describe, expect, it } from "vitest";
import {
  InstantlySessionImpl,
  PILOT_INSTANTLY_WORKSPACE,
  describeInstantlyAccount,
  describeInstantlyVendor,
  loadInstantlyWorkspace,
} from "../src/instantly.js";
import {
  INSTANTLY_API_ORIGIN,
  INSTANTLY_FORBIDDEN_METHODS,
  InstantlyReadOnlyError,
  assertInstantlyReadOnlyMethod,
  assertInstantlyReadRequest,
  instantlyUrl,
} from "../src/instantly-api.js";

describe("instantly-gatekeeper", () => {
  it("describes an auto-provisioned read-only Instantly singleton", () => {
    expect(describeInstantlyVendor()).toMatchObject({
      displayName: "Instantly",
      autoProvisionsAccount: true,
      providesAuth: false,
    });
    expect(describeInstantlyVendor().tagline.toLowerCase()).toContain("no send/activate");
    expect(describeInstantlyAccount()).toMatchObject({
      displayName: "Instantly",
      singleton: { tsType: "InstantlySession" },
    });
  });

  it("authorizes observations before returning the Intraplex fixture catalog", async () => {
    const observations: { title: string; description: string }[] = [];
    const session = new InstantlySessionImpl(
      {
        authorizeObservation(value) {
          observations.push(value as { title: string; description: string });
          return Promise.resolve();
        },
      },
      structuredClone(PILOT_INSTANTLY_WORKSPACE),
    );

    await expect(session.listCampaigns()).resolves.toEqual(PILOT_INSTANTLY_WORKSPACE.campaigns);
    await expect(session.getCampaign("camp_intraplex")).resolves.toMatchObject({
      name: "Intraplex ICP — outbound",
      status: "draft",
    });
    expect(observations[0]).toEqual({
      title: "List Instantly campaigns",
      description: "Read campaign catalog (no send/activate).",
    });
  });

  it("rejects Instantly write verbs and write HTTP", async () => {
    for (const method of INSTANTLY_FORBIDDEN_METHODS) {
      expect(() => assertInstantlyReadOnlyMethod(method)).toThrow(InstantlyReadOnlyError);
    }
    expect(() => assertInstantlyReadRequest("POST", "/api/v2/campaigns/camp_intraplex/activate")).toThrow(
      InstantlyReadOnlyError,
    );
    expect(() => assertInstantlyReadRequest("GET", "/api/v2/campaigns/camp_intraplex/pause")).toThrow(
      InstantlyReadOnlyError,
    );
    expect(() => assertInstantlyReadRequest("GET", "/api/v2/campaigns?limit=10")).not.toThrow();
    expect(() => instantlyUrl("https://evil.example/api/v2/campaigns")).toThrow(InstantlyReadOnlyError);
    expect(instantlyUrl("/api/v2/campaigns?limit=10")).toBe(`${INSTANTLY_API_ORIGIN}/api/v2/campaigns?limit=10`);
  });

  it("maps live GET payloads and falls back to the Intraplex fixture without a key", async () => {
    const fixture = await loadInstantlyWorkspace(null);
    expect(fixture.campaigns[0]?.name).toBe("Intraplex ICP — outbound");

    const live = await loadInstantlyWorkspace({
      async get(path: string) {
        if (path.startsWith("/api/v2/campaigns")) {
          return { items: [{ id: "c1", name: "Live ICP", status: 0 }] };
        }
        if (path.startsWith("/api/v2/accounts")) {
          return { items: [{ email: "ops@example.com", warmup_enabled: true, status: 1 }] };
        }
        throw new Error(path);
      },
    });
    expect(live.campaigns).toEqual([
      { id: "c1", name: "Live ICP", status: "draft", accountEmail: null },
    ]);
    expect(live.accounts).toEqual([
      { email: "ops@example.com", warmupEnabled: true, status: "active" },
    ]);
  });
});
