import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  INSTANTLY_FORBIDDEN_METHODS,
  InstantlySessionImpl,
  assertInstantlyReadOnly,
} from "connectivity";
import { runPilotBound } from "./bound.js";
import { INSTANTLY_PILOT_WORKSPACE } from "./fixture.js";
import { INTRAPLEX_PLAYBOOK } from "./playbook.js";
import { PilotHome } from "./PilotHome.js";
import { STANDING_INSTRUCTION_STEPS, STANDING_INSTRUCTIONS } from "./standing-instructions.js";

describe("OS pilot bound", () => {
  it("names every standing-instruction step the bound requires", () => {
    const text = STANDING_INSTRUCTIONS.toLowerCase();
    for (const step of STANDING_INSTRUCTION_STEPS) {
      expect(text).toContain(step);
    }
    expect(STANDING_INSTRUCTIONS.toLowerCase()).toContain("send");
    expect(STANDING_INSTRUCTIONS.toLowerCase()).toContain("activate");
    expect(STANDING_INSTRUCTIONS.toLowerCase()).not.toContain("/admin");
  });

  it("inspects the Intraplex playbook before asking, then lists Instantly campaigns in the table", async () => {
    const observations: { title: string }[] = [];
    const session = new InstantlySessionImpl(INSTANTLY_PILOT_WORKSPACE, {
      authorizeObservation: async (observation) => {
        observations.push(observation);
      },
    });
    const bound = await runPilotBound(session);
    expect(bound.playbookTitle).toBe("Playbook: Intraplex ICP");
    expect(bound.askReady).toBe(true);
    expect(bound.inspected[0]).toContain("Intraplex");
    expect(bound.ask.toLowerCase()).toContain("ask");
    expect(bound.instantlyCampaigns).toBe(1);
    expect(bound.table).toEqual([
      {
        company: "Intraplex",
        contact: "Ada <ada@intraplex.example>",
        campaign: "Intraplex ICP — outbound",
        status: "draft",
        source: "instantly",
      },
    ]);
    expect(observations.some((row) => /campaign/i.test(row.title))).toBe(true);
    expect(bound.instantlyForbidden).toEqual([...INSTANTLY_FORBIDDEN_METHODS]);
  });

  it("closes Instantly write verbs; the bound still completes as reads", async () => {
    expect(() => assertInstantlyReadOnly("activate")).toThrow(/not implemented/);
    expect(() => assertInstantlyReadOnly("send")).toThrow(/not implemented/);
    await expect(runPilotBound()).resolves.toMatchObject({ instantlyCampaigns: 1 });
  });

  it("renders playbook, ask, table gadget, and Instantly reads-only copy", async () => {
    const bound = await runPilotBound();
    const html = renderToString(createElement(PilotHome, { bound }));
    expect(html).toContain("data-surface=\"os-pilot\"");
    expect(html).toContain("data-bound=\"inspect-ask-table-instantly\"");
    expect(html).toContain(INTRAPLEX_PLAYBOOK.title);
    expect(html).toContain("data-gadget=\"table\"");
    expect(html).toContain("Intraplex ICP — outbound");
    expect(html).toContain("data-instantly=\"reads-only\"");
    expect(html).toContain("data-instructions=\"standing\"");
    expect(html).toContain("/admin");
    expect(html).not.toMatch(/macro/i);
    expect(html).not.toMatch(/activate campaign|send email/i);
  });
});
