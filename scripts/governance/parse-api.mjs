const INTERFACE_RE = /export\s+interface\s+(\w+)([^{]*)\{/g;

function lineOf(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function findMatchingBrace(text, openPos) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = openPos; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("Unmatched interface brace");
}

/** Replace comment contents with spaces, preserving newlines and string literals. */
export function maskComments(text) {
  const out = text.split("");
  let i = 0;
  let quote = null;
  let escaped = false;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      while (i < text.length - 1 && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < text.length - 1) {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
      }
      continue;
    }
    i++;
  }
  return out.join("");
}

function* topLevelStatements(body) {
  let start = 0;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let angle = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(") paren++;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "[") bracket++;
    else if (ch === "]") bracket = Math.max(0, bracket - 1);
    else if (ch === "{") brace++;
    else if (ch === "}") brace = Math.max(0, brace - 1);
    else if (ch === "<") angle++;
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === ";" && paren === 0 && bracket === 0 && brace === 0 && angle === 0) {
      yield { start, text: body.slice(start, i).trim() };
      start = i + 1;
    }
  }
}

const METHOD_RE = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(?:<.*?>)?\s*\(/;

/**
 * Mechanical inventory of named interface methods in api.ts, plus the one
 * anonymous callback capability (Overseer.subscribeToMetadata.callback).
 */
export function parseApiCapabilities(sourceText) {
  const text = maskComments(sourceText);
  const rows = [];
  INTERFACE_RE.lastIndex = 0;
  let match;
  while ((match = INTERFACE_RE.exec(text))) {
    const name = match[1];
    const openPos = text.indexOf("{", match.index);
    const closePos = findMatchingBrace(text, openPos);
    const body = text.slice(openPos + 1, closePos);
    const bodyAbsoluteStart = openPos + 1;
    for (const statement of topLevelStatements(body)) {
      const normalized = statement.text.replace(/\s+/g, " ").trim();
      const method = normalized.match(METHOD_RE);
      if (!method) continue;
      rows.push({
        interface: name,
        method: method[1],
        id: `${name}.${method[1]}`,
        signature: normalized,
        sourceLine: lineOf(text, bodyAbsoluteStart + statement.start),
      });
      if (normalized.includes("RpcStub<(")) {
        rows.push({
          interface: name,
          method: `${method[1]}.callback`,
          id: `${name}.${method[1]}.callback`,
          signature: normalized,
          sourceLine: lineOf(text, bodyAbsoluteStart + statement.start),
          anonymousCallback: true,
        });
      }
    }
  }
  return rows;
}

export function exportedNames(sourceText) {
  const names = new Set();
  const re =
    /^export\s+(?:async\s+)?(?:const|function|class|enum|type|interface)\s+([A-Za-z_$][\w$]*)/gm;
  let match;
  while ((match = re.exec(sourceText))) names.add(match[1]);
  return names;
}
