/**
 * ~7 command identities for N10 settings / chat / automation surfaces.
 * Chat send stays on the kernel Overseer.
 */
export const N10_COMMAND_IDS = [
  "settings.connections",
  "settings.mcp",
  "settings.bots",
  "chat.stop",
  "chat.retry",
  "automation.create",
  "import.start",
] as const;

export type N10CommandId = (typeof N10_COMMAND_IDS)[number];
