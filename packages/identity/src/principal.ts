import { parseTypedId } from "./ids.js";

/** Kernel deployment admin is orthogonal to team role (ADMINS env / getAdminApi mint). */
export type DeploymentAdminPolicy = ReadonlySet<string>;

/** Team roles. Mutations require owner or admin (ADR-004 team policy, enforced here until N2 receipts). */
export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_RANK: Record<TeamRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export type PrincipalKind = "user" | "team" | "bot";

export interface Principal {
  kind: PrincipalKind;
  id: string;
  /** Team tenant the actor is currently operating in; null for unscoped session. */
  tenantId: string | null;
}

export interface ActorContext {
  actor: Principal;
  kernelUsername: string;
  isDeploymentAdmin: boolean;
  /** Agent delegation slot for N2. N1 never fills this. */
  onBehalfOf?: Principal;
}

export interface MembershipRow {
  userId: string;
  teamId: string;
  role: TeamRole;
  updatedAt: number;
}

export interface TeamRecord {
  id: string;
  name: string;
  createdAt: number;
}

export interface InviteRecord {
  id: string;
  teamId: string;
  inviteeUsername: string;
  role: TeamRole;
  createdBy: string;
  idempotencyKey: string;
  consumed: boolean;
  consumedBy?: string;
}

export function userPrincipal(userId: string, tenantId: string | null = null): Principal {
  parseTypedId(userId);
  return { kind: "user", id: userId, tenantId };
}

export function isDeploymentAdmin(
  kernelUsername: string,
  policy: DeploymentAdminPolicy,
): boolean {
  return policy.has(kernelUsername);
}

export function canMutateTeam(role: TeamRole | null): boolean {
  return role === "owner" || role === "admin";
}
