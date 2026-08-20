import { TITLE_BOOST, MAX_INDEX_BODY_CHARS } from "./types.js";

/** Same tokenizer as soup `SearchIndex` (lexical token overlap). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 0);
}

/**
 * OD-15 title-boost prototype. Score = title matches × 3 + body matches.
 * Stable sort is applied by the caller: score desc, updatedAt desc, entityId.
 */
export function titleBoostScore(title: string, body: string, query: string): number {
  const terms = tokenize(query);
  if (terms.length === 0) return 0;
  const titleTokens = tokenize(title);
  const bodyTokens = tokenize(body);
  let titleHits = 0;
  let bodyHits = 0;
  for (const term of terms) {
    titleHits += titleTokens.filter((token) => token === term).length;
    bodyHits += bodyTokens.filter((token) => token === term).length;
  }
  return titleHits * TITLE_BOOST + bodyHits;
}

export function extractBody(payload: Record<string, unknown>): string {
  if (typeof payload.body === "string") return payload.body;
  if (typeof payload.text === "string") return payload.text;
  return "";
}

/** Empty / whitespace / NUL / oversized bodies are poison (pattern 3a). */
export function isPoisonBody(body: string): boolean {
  if (body.trim().length === 0) return true;
  if (body.includes("\0")) return true;
  if (body.length > MAX_INDEX_BODY_CHARS) return true;
  return false;
}

export function compareHits<T extends { score: number; updatedAt: number; entityId: string }>(a: T, b: T): number {
  return b.score - a.score || b.updatedAt - a.updatedAt || a.entityId.localeCompare(b.entityId);
}
