import { describe, expect, it } from "vitest";
import { classifyOutreachPath } from "./routes.js";

describe("ADR-002 Outreach router", () => {
  it("keeps kernel PublicApi on /api and wrapper TaskDomainApi on /domain", () => {
    expect(classifyOutreachPath("/api")).toBe("kernel-capnp");
    expect(classifyOutreachPath("/domain")).toBe("domain-capnp");
    expect(classifyOutreachPath("/subscribe")).toBe("streaming");
    expect(classifyOutreachPath("/hooks/github")).toBe("webhook");
    expect(classifyOutreachPath("/")).toBe("health");
  });

  it("rejects REST /rpc (negative: no wrapper HTTP recreation of Neuwave endpoints)", () => {
    expect(classifyOutreachPath("/rpc")).toBe("rest-rejected");
    expect(classifyOutreachPath("/rpc/createTask")).toBe("rest-rejected");
  });
});
