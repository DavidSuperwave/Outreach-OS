/**
 * N15 has 0 command rows (05-GRAPH §N15). Chrome lives on N7 (`go-to.documents`,
 * ConvertedPdf viewer) and N13 (`go-to.calls` recording preview).
 */
export const CONVERTER_COMMAND_IDS = [] as const;
export type ConverterCommandId = (typeof CONVERTER_COMMAND_IDS)[number];

/** Consumer chrome — not owned here. */
export const N15_CHROME_COMMAND_IDS = ["go-to.documents", "go-to.calls"] as const;
export type N15ChromeCommandId = (typeof N15_CHROME_COMMAND_IDS)[number];
