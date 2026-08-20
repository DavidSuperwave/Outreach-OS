import { fixtureId, resetIdSequence } from "./ids.js";
import { TeamsApi } from "./teams-api.js";
import type { KernelSession } from "./teams-api.js";

/** OD-1 Branch A seed fixtures. Kernel usernames: admin is in ADMINS; member is not. */
export const SEED_ADMIN: KernelSession = {
  username: "admin",
  userId: fixtureId("user", 1),
};

export const SEED_MEMBER: KernelSession = {
  username: "member",
  userId: fixtureId("user", 2),
};

export const SEED_OUTSIDER: KernelSession = {
  username: "outsider",
  userId: fixtureId("user", 3),
};

export function loadSeedFixtures(): {
  api: TeamsApi;
  teamId: string;
  inviteId: string;
} {
  resetIdSequence();
  const api = new TeamsApi(new Set(["admin"]));
  api.registerKernelUser(SEED_ADMIN);
  api.registerKernelUser(SEED_MEMBER);
  api.registerKernelUser(SEED_OUTSIDER);
  const team = api.createTeam(SEED_ADMIN, "Outreach");
  const invite = api.invite(SEED_ADMIN, team.id, "member", "member", "seed-invite-member");
  api.acceptInvite(SEED_MEMBER, team.id, invite.id);
  return { api, teamId: team.id, inviteId: invite.id };
}
