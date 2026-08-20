import type {
  AdminApi,
  AuthenticatedApi,
  ConnectedAccountsSubscriber,
  LoginAttempt,
  PublicApi,
} from "@gadgets/workshop-shared/api";

/** Compile-time consume of the 28 N1 kernel methods. A rename in api.ts fails this file. */
type Need<T, K extends keyof T> = K;

export type N1PublicApiMethods = [
  Need<PublicApi, "getServerConfig">,
  Need<PublicApi, "startGatekeeperLogin">,
  Need<PublicApi, "authenticate">,
  Need<PublicApi, "authenticateFromCfAccess">,
  Need<PublicApi, "login">,
  Need<PublicApi, "createAccount">,
  Need<PublicApi, "getBlueprint">,
  Need<PublicApi, "downloadBlueprint">,
];

export type N1LoginAttemptMethods = [Need<LoginAttempt, "wait">];

export type N1AdminApiMethods = [
  Need<AdminApi, "getSettings">,
  Need<AdminApi, "setSignupsEnabled">,
  Need<AdminApi, "setSiteName">,
  Need<AdminApi, "setSiteLogo">,
  Need<AdminApi, "setInstanceInstructions">,
  Need<AdminApi, "setResourceEnabled">,
  Need<AdminApi, "setGatekeeperMode">,
  Need<AdminApi, "setAnnouncement">,
  Need<AdminApi, "setBanner">,
  Need<AdminApi, "setAccentColor">,
  Need<AdminApi, "isBlueprintFeatured">,
  Need<AdminApi, "setBlueprintFeatured">,
  Need<AdminApi, "promoteFormat">,
  Need<AdminApi, "removeFormat">,
  Need<AdminApi, "updateFormat">,
  Need<AdminApi, "setFormatOrder">,
];

export type N1ConnectedAccountsMethods = [
  Need<ConnectedAccountsSubscriber, "add">,
  Need<ConnectedAccountsSubscriber, "remove">,
  Need<ConnectedAccountsSubscriber, "ready">,
];

export type N1AdminMint = Need<AuthenticatedApi, "getAdminApi">;

/** Kernel session token format from PublicApiImpl.login: `${username}:${secret}`. */
export function parseKernelSessionToken(token: string): { username: string; secret: string } {
  const cut = token.indexOf(":");
  if (cut <= 0 || cut === token.length - 1) {
    throw new Error("invalid kernel session token");
  }
  return { username: token.slice(0, cut), secret: token.slice(cut + 1) };
}
