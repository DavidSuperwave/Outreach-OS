from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

CALL_RE = re.compile(r'\b(registerHotkey|registerScope)\s*\(')
FIELD_NAMES = ['hotkeyToken', 'hotkey', 'scopeId', 'parentScopeId', 'description', 'displayPriority',
               'handlerPriority', 'condition', 'hide', 'runWithInputFocused', 'activateCommandScope',
               'activateCommandScopeId', 'registrationType', 'tags', 'keywords']


def line_of(text: str, offset: int) -> int:
    return text.count('\n', 0, offset) + 1


def find_call_end(text: str, open_paren: int) -> int:
    depth = 0
    quote = None
    escaped = False
    for i in range(open_paren, len(text)):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            continue
        if ch in ('"', "'", '`'):
            quote = ch
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0:
                return i
    raise ValueError('Unmatched call parenthesis')


def extract_field(block: str, name: str) -> str:
    match = re.search(rf'\b{re.escape(name)}\s*:\s*', block)
    if not match:
        return ''
    i = match.end()
    start = i
    paren = bracket = brace = 0
    quote = None
    escaped = False
    while i < len(block):
        ch = block[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
        else:
            if ch in ('"', "'", '`'):
                quote = ch
            elif ch == '(':
                paren += 1
            elif ch == ')':
                if paren == 0:
                    break
                paren -= 1
            elif ch == '[':
                bracket += 1
            elif ch == ']':
                bracket = max(0, bracket - 1)
            elif ch == '{':
                brace += 1
            elif ch == '}':
                if brace == 0:
                    break
                brace -= 1
            elif ch == ',' and paren == bracket == brace == 0:
                break
        i += 1
    return ' '.join(block[start:i].strip().split())


def main() -> int:
    parser = argparse.ArgumentParser(description='Inventory registerHotkey/registerScope call sites.')
    parser.add_argument('--root', required=True, help='Neuwave repo root')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    rows = []
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix not in {'.ts', '.tsx'}:
            continue
        if any(part in {'node_modules', 'dist', 'build', '.git'} for part in path.parts):
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        for match in CALL_RE.finditer(text):
            call = match.group(1)
            open_paren = text.find('(', match.start())
            try:
                close = find_call_end(text, open_paren)
            except ValueError:
                close = min(len(text), open_paren + 2000)
            block = text[open_paren + 1:close]
            row = {
                'registration': call,
                'source_path': str(path.relative_to(root)),
                'source_line': line_of(text, match.start()),
                'raw_excerpt': ' '.join(block[:500].split()),
                'dynamic_context': bool(re.search(r'\.(forEach|map)\s*\(|\bfor\s*\(', text[max(0, match.start()-500):match.start()])),
                'review_status': 'mechanical-needs-manual-review',
            }
            for field in FIELD_NAMES:
                row[field] = extract_field(block, field)
            rows.append(row)

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ['registration', 'source_path', 'source_line', *FIELD_NAMES, 'dynamic_context', 'raw_excerpt', 'review_status']
    with output.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Wrote {len(rows)} registration-site rows to {output}')
    print('Expand data-driven loops, unkeyed command entries, and runtime scope trees manually.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
