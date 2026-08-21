import {
  INSTANTLY_FORBIDDEN_METHODS,
  InstantlySessionImpl,
  type InstantlySession,
} from "connectivity";
import { INTRAPLEX_ICP_ROWS, INSTANTLY_PILOT_WORKSPACE, mergeTableRows, type IcpTableRow } from "./fixture.js";
import { INTRAPLEX_PLAYBOOK, inspectPlaybook, type IntraplexPlaybook } from "./playbook.js";
import { STANDING_INSTRUCTIONS } from "./standing-instructions.js";

export interface PilotBoundResult {
  standingInstructions: string
  playbookTitle: string
  inspected: readonly string[]
  ask: string
  askReady: boolean
  table: readonly IcpTableRow[]
  instantlyCampaigns: number
  instantlyForbidden: readonly string[]
}

/**
 * OS-pilot bound: standing instructions → Playbooks + Intraplex ICP → inspect → ask →
 * table gadget → Instantly reads. Instantly write verbs stay absent from the session.
 */
export async function runPilotBound(
  session: InstantlySession = new InstantlySessionImpl(INSTANTLY_PILOT_WORKSPACE, {
    authorizeObservation: async () => {},
  }),
  playbook: IntraplexPlaybook = INTRAPLEX_PLAYBOOK,
): Promise<PilotBoundResult> {
  const inspected = inspectPlaybook(playbook);
  const campaigns = await session.listCampaigns();
  const table = mergeTableRows(INTRAPLEX_ICP_ROWS, campaigns);
  return {
    standingInstructions: STANDING_INSTRUCTIONS,
    playbookTitle: playbook.title,
    inspected: inspected.inspected,
    ask: playbook.ask,
    askReady: inspected.askReady,
    table,
    instantlyCampaigns: campaigns.length,
    instantlyForbidden: INSTANTLY_FORBIDDEN_METHODS,
  };
}
