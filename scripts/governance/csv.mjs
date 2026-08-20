/** RFC 4180-ish CSV parser. Returns an array of row objects keyed by the header. */
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
      if (ch === "\r") i++;
      row.push(field);
      field = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.length)) rows.push(row);
  }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).map((values) => {
    const record = {};
    header.forEach((key, index) => {
      record[key] = values[index] ?? "";
    });
    return record;
  });
}
