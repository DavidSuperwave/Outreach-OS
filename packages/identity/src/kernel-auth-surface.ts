/**
 * The 28 kernel RPC rows N1 consumes. Names are frozen at bf7f762 (ADR-002 / N0).
 * Live workshop calls stay on kernel /api; this module is the wrapper's inventory gate.
 */
export const N1_KERNEL_SURFACE = [
  { iface: "LoginAttempt", method: "wait", test: "contract:capability-lifecycle" },
  { iface: "PublicApi", method: "getServerConfig", test: "contract:req-resp" },
  { iface: "PublicApi", method: "startGatekeeperLogin", test: "contract:capability-lifecycle" },
  { iface: "PublicApi", method: "authenticate", test: "contract:capability-lifecycle" },
  { iface: "PublicApi", method: "authenticateFromCfAccess", test: "contract:req-resp", needsReview: "OD-12b keep-but-disabled" },
  { iface: "PublicApi", method: "login", test: "contract:req-resp" },
  { iface: "PublicApi", method: "createAccount", test: "contract:req-resp" },
  { iface: "PublicApi", method: "getBlueprint", test: "contract:req-resp" },
  { iface: "PublicApi", method: "downloadBlueprint", test: "contract:streaming" },
  { iface: "ConnectedAccountsSubscriber", method: "add", test: "parity:subscription-replay" },
  { iface: "ConnectedAccountsSubscriber", method: "remove", test: "parity:subscription-replay" },
  { iface: "ConnectedAccountsSubscriber", method: "ready", test: "parity:subscription-replay" },
  { iface: "AdminApi", method: "getSettings", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setSignupsEnabled", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setSiteName", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setSiteLogo", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setInstanceInstructions", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setResourceEnabled", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setGatekeeperMode", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setAnnouncement", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setBanner", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setAccentColor", test: "contract:req-resp" },
  { iface: "AdminApi", method: "isBlueprintFeatured", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setBlueprintFeatured", test: "contract:req-resp" },
  { iface: "AdminApi", method: "promoteFormat", test: "contract:req-resp" },
  { iface: "AdminApi", method: "removeFormat", test: "contract:req-resp" },
  { iface: "AdminApi", method: "updateFormat", test: "contract:req-resp" },
  { iface: "AdminApi", method: "setFormatOrder", test: "contract:req-resp" },
] as const;

export const N1_KERNEL_SURFACE_COUNT = 28;

/** Frozen SERVICE_SALT from api.ts:30 at pin bf7f762. */
export const SERVICE_SALT = new Uint8Array([
  0xd9, 0x4e, 0x54, 0x1d, 0x29, 0xc1, 0x03, 0x74, 0x73, 0x7e, 0xb3, 0xe3, 0x34, 0x6d, 0x8f, 0x21,
]);
