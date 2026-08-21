import { INTRAPLEX_PLAYBOOK } from "./playbook.js";
import { STANDING_INSTRUCTIONS } from "./standing-instructions.js";
import { TableGadget } from "./table-gadget.js";
import { INTRAPLEX_ICP_ROWS, INSTANTLY_PILOT_WORKSPACE, mergeTableRows, type IcpTableRow } from "./fixture.js";

export interface PilotHomeBound {
  playbookTitle: string
  inspected: readonly string[]
  ask: string
  table: readonly IcpTableRow[]
  instantlyCampaigns: number
}

const FIXTURE_BOUND: PilotHomeBound = {
  playbookTitle: INTRAPLEX_PLAYBOOK.title,
  inspected: INTRAPLEX_PLAYBOOK.inspectItems,
  ask: INTRAPLEX_PLAYBOOK.ask,
  table: mergeTableRows(INTRAPLEX_ICP_ROWS, INSTANTLY_PILOT_WORKSPACE.campaigns),
  instantlyCampaigns: INSTANTLY_PILOT_WORKSPACE.campaigns.length,
};

export function PilotHome({
  bound = FIXTURE_BOUND,
}: {
  bound?: PilotHomeBound
}) {
  return (
    <div data-surface="os-pilot" data-bound="inspect-ask-table-instantly">
      <section data-surface="standing-instructions">
        <h1>Standing instructions</h1>
        <p>Paste into <code>/admin</code> agent instructions.</p>
        <pre data-instructions="standing">{STANDING_INSTRUCTIONS}</pre>
      </section>
      <section data-surface="playbook" data-playbook={bound.playbookTitle}>
        <h1>{INTRAPLEX_PLAYBOOK.title}</h1>
        {INTRAPLEX_PLAYBOOK.sections.map((section) => (
          <article key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </article>
        ))}
        <ol data-inspect="intraplex-icp">
          {bound.inspected.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p data-ask="">{bound.ask}</p>
      </section>
      <TableGadget rows={bound.table} />
      <p data-instantly="reads-only">
        Instantly reads: {bound.instantlyCampaigns} campaign{bound.instantlyCampaigns === 1 ? "" : "s"}.
        Send/activate are closed.
      </p>
    </div>
  );
}
