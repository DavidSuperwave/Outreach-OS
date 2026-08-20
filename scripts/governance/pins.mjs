/**
 * Frozen N0 pins. Changing any of these is an ADR-014 pin-bump event:
 * update KERNEL-STATUS.md, re-run the contract suite, and land an ADR-lite note.
 */
export const KERNEL_PIN = "bf7f762d7fa73553284d731ab6a978d3ea17be24";
export const KERNEL_SUBMODULE_PATH = "cloudflare-os";
export const API_TS_RELATIVE = "packages/workshop-shared/src/api.ts";
export const API_TS_SHA256 =
  "30a2cade8a3425e69664fc4d6c71d370d0a28aa1c42c676f1126d4d13ed15ef3";
export const RPC_LEDGER_RELATIVE =
  "docs/neuwave-rewrite/reports/02-rpc-compatibility-ledger.csv";
export const RPC_LEDGER_SHA256 =
  "40988bcb34a282caec7640a7f1bca348597a55d35d3fa76039c6abdef4071a73";
export const RPC_CAPABILITY_COUNT = 182;
export const ANONYMOUS_CALLBACK_ROW = "Overseer.subscribeToMetadata.callback";

/** Wire-level constants/helpers frozen alongside the 182 callable rows (wp020 §5). */
export const NON_CALLABLE_CONTRACT_EXPORTS = [
  "SERVICE_SALT",
  "OPEN_GADGET_ERROR_CODES",
  "validateBindingName",
  "MAX_ANNOUNCEMENT_LENGTH",
  "MAX_SITE_NAME_LENGTH",
  "MAX_INSTANCE_INSTRUCTIONS_LENGTH",
  "MAX_SITE_LOGO_BYTES",
  "MAX_SITE_LOGO_DIMENSION",
  "BANNER_COLORS",
  "AMBIENT_GATEKEEPER_MODES",
  "OUTPUT_ICONS",
  "SUGGESTED_MODELS",
  "WORKERS_AI_OUTPUT_LIMIT",
  "isTextLikeAttachmentMimeType",
  "blueprintScreenshotUrl",
  "isHexColor",
  "isBannerColor",
  "isOutputIcon",
  "isAmbientGatekeeperMode",
  "resolveSiteName",
  "createOpenGadgetError",
  "getOpenGadgetErrorCode",
];
