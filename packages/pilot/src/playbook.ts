/** Intraplex ICP playbook — the OS-pilot inspect surface. */
export interface PlaybookSection {
  heading: string
  body: string
}

export interface IntraplexPlaybook {
  title: "Playbook: Intraplex ICP"
  inspectThenAsk: true
  sections: readonly PlaybookSection[]
  inspectItems: readonly string[]
  ask: string
}

export const INTRAPLEX_PLAYBOOK: IntraplexPlaybook = {
  title: "Playbook: Intraplex ICP",
  inspectThenAsk: true,
  sections: [
    {
      heading: "Who",
      body: "Series A–C B2B teams that already run outbound and need governed Instantly reads inside Outreach OS.",
    },
    {
      heading: "Why now",
      body: "The OS-pilot bound is inspect → ask → table gadget → Instantly reads. No send/activate until David orders it.",
    },
    {
      heading: "Proof",
      body: "Intraplex is the named demo account: company, contact Ada, and a draft Instantly campaign the table gadget can list.",
    },
  ],
  inspectItems: [
    "Company: Intraplex",
    "Contact: Ada <ada@intraplex.example>",
    "Campaign: Intraplex ICP — outbound (draft)",
  ],
  ask: "After inspect, ask: which Intraplex ICP accounts should the table gadget keep visible this week?",
};

export function inspectPlaybook(playbook: IntraplexPlaybook = INTRAPLEX_PLAYBOOK): {
  title: string
  inspected: readonly string[]
  askReady: boolean
} {
  return {
    title: playbook.title,
    inspected: playbook.inspectItems,
    askReady: playbook.inspectThenAsk && playbook.inspectItems.length > 0,
  };
}
