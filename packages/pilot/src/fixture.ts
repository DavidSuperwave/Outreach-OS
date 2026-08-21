import type { InstantlyWorkspace } from "connectivity";

export interface IcpTableRow {
  company: string
  contact: string
  campaign: string
  status: "draft" | "active" | "paused" | "completed"
  source: "icp" | "instantly"
}

export const INTRAPLEX_ICP_ROWS: readonly IcpTableRow[] = [
  {
    company: "Intraplex",
    contact: "Ada <ada@intraplex.example>",
    campaign: "Intraplex ICP — outbound",
    status: "draft",
    source: "icp",
  },
];

/** Fixture Instantly workspace used when INSTANTLY_API_KEY is unset. */
export const INSTANTLY_PILOT_WORKSPACE: InstantlyWorkspace = {
  campaigns: [
    {
      id: "camp_intraplex",
      name: "Intraplex ICP — outbound",
      status: "draft",
      accountEmail: "hello@superwave.example",
    },
  ],
  accounts: [
    {
      email: "hello@superwave.example",
      warmupEnabled: true,
      status: "active",
    },
  ],
  leads: [
    {
      id: "lead_ada",
      email: "ada@intraplex.example",
      campaignId: "camp_intraplex",
      company: "Intraplex",
    },
  ],
  emails: [],
};

export function mergeTableRows(
  icp: readonly IcpTableRow[],
  campaigns: readonly { name: string; status: IcpTableRow["status"] }[],
): IcpTableRow[] {
  const fromInstantly: IcpTableRow[] = campaigns.map((campaign) => {
    const icpHit = icp.find((row) => row.campaign === campaign.name);
    return {
      company: icpHit?.company ?? "—",
      contact: icpHit?.contact ?? "—",
      campaign: campaign.name,
      status: campaign.status,
      source: "instantly",
    };
  });
  const unmatchedIcp = icp.filter((row) => !campaigns.some((campaign) => campaign.name === row.campaign));
  return [...fromInstantly, ...unmatchedIcp];
}
