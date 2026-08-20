import { ConverterError } from "./errors.js";
import { contentSha, decodeUtf8, encodeUtf8 } from "./store.js";
import {
  GOLDEN_DOCX_V1,
  PDF_PREFIX,
  POISON_DOCX,
  type ContainerPort,
} from "./types.js";

/**
 * In-process stand-in for the LibreOffice/Collabora container.
 * Pure `{input bytes} → {output bytes}`. No R2 keys, no HTTP, no fetch.
 *
 * GOLDEN_DOCX_V1 → `PDF:` + sha256(input).
 * POISON_DOCX → convert_failed (hostile fixture; does not breach the boundary).
 */
export function goldenContainer(): ContainerPort {
  return {
    transform(input: Uint8Array): Uint8Array {
      const text = decodeUtf8(input);
      if (text === POISON_DOCX) {
        throw new ConverterError("convert_failed", "poison fixture failed conversion");
      }
      // Named golden fixture (and any non-poison stand-in) is deterministic
      // per input sha. Live LibreOffice/font-metric parity is a later lift.
      void GOLDEN_DOCX_V1;
      return encodeUtf8(`${PDF_PREFIX}${contentSha(input)}`);
    },
  };
}

export function goldenPdfBody(input: Uint8Array): string {
  return `${PDF_PREFIX}${contentSha(input)}`;
}
