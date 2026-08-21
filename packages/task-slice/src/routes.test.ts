import { describe, expect, it } from "vitest";
import { classifyOutreachPath } from "./routes.js";

describe("ADR-002 Outreach router", () => {
  it("keeps kernel PublicApi on /api and wrapper TaskDomainApi on /domain", () => {
    expect(classifyOutreachPath("/api")).toBe("kernel-capnp");
    expect(classifyOutreachPath("/domain")).toBe("domain-capnp");
    expect(classifyOutreachPath("/subscribe")).toBe("streaming");
    expect(classifyOutreachPath("/hooks/github")).toBe("webhook");
    expect(classifyOutreachPath("/health")).toBe("health");
  });

  it("serves the custom React shell on the 27-route map and split codec", () => {
    expect(classifyOutreachPath("/")).toBe("shell");
    expect(classifyOutreachPath("/tasks")).toBe("shell");
    expect(classifyOutreachPath("/login")).toBe("shell");
    expect(classifyOutreachPath("/signup")).toBe("shell");
    expect(classifyOutreachPath("/tasks/_")).toBe("shell");
    expect(classifyOutreachPath("/desktop-auth")).toBe("not-found");
    expect(classifyOutreachPath("/.well-known")).toBe("not-found");
    expect(classifyOutreachPath("/oauth/callback")).toBe("oauth");
    expect(classifyOutreachPath("/assets/outreach-shell.js")).toBe("asset");
  });

  it("rejects REST /rpc (negative: no wrapper HTTP recreation of Neuwave endpoints)", () => {
    expect(classifyOutreachPath("/rpc")).toBe("rest-rejected");
    expect(classifyOutreachPath("/rpc/createTask")).toBe("rest-rejected");
  });
});
