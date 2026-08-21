/**
 * N14 has 0 direct command rows (05-GRAPH §N14). Upload chrome lives on N5
 * (`global.upload-files` / `global.upload-folders`) and block paste/drop.
 */
export const FILE_COMMAND_IDS = [] as const;
export type FileCommandId = (typeof FILE_COMMAND_IDS)[number];

export const N14_PARITY_COMMAND_IDS = ["global.upload-files", "global.upload-folders"] as const;
export type N14ParityCommandId = (typeof N14_PARITY_COMMAND_IDS)[number];
