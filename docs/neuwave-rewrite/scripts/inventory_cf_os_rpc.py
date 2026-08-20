from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

INTERFACE_RE = re.compile(r'export\s+interface\s+(\w+)([^\{]*)\{', re.MULTILINE)


def line_of(text: str, offset: int) -> int:
    return text.count('\n', 0, offset) + 1


def find_matching_brace(text: str, open_pos: int) -> int:
    depth = 0
    quote = None
    escaped = False
    i = open_pos
    while i < len(text):
        ch = text[i]
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
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return i
        i += 1
    raise ValueError('Unmatched interface brace')


def strip_comments(text: str) -> str:
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'//.*', '', text)
    return text


def mask_comments(text: str) -> str:
    # Replace comment contents with spaces (newlines preserved) so that quotes and
    # braces inside comments cannot corrupt string/brace tracking. Quote-aware so
    # that "//" inside string literals (e.g. URLs) is not treated as a comment.
    out = list(text)
    i = 0
    n = len(text)
    quote = None
    escaped = False
    while i < n:
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            quote = ch
            i += 1
            continue
        if ch == '/' and i + 1 < n:
            nxt = text[i + 1]
            if nxt == '/':
                j = i
                while j < n and text[j] != '\n':
                    out[j] = ' '
                    j += 1
                i = j
                continue
            if nxt == '*':
                j = i
                while j < n - 1 and not (text[j] == '*' and text[j + 1] == '/'):
                    if text[j] != '\n':
                        out[j] = ' '
                    j += 1
                if j < n - 1:
                    out[j] = ' '
                    out[j + 1] = ' '
                    j += 2
                i = j
                continue
        i += 1
    return ''.join(out)


def top_level_statements(body: str):
    start = 0
    paren = bracket = brace = angle = 0
    quote = None
    escaped = False
    for i, ch in enumerate(body):
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
            paren += 1
        elif ch == ')':
            paren = max(0, paren - 1)
        elif ch == '[':
            bracket += 1
        elif ch == ']':
            bracket = max(0, bracket - 1)
        elif ch == '{':
            brace += 1
        elif ch == '}':
            brace = max(0, brace - 1)
        elif ch == '<':
            angle += 1
        elif ch == '>':
            angle = max(0, angle - 1)
        elif ch == ';' and paren == bracket == brace == angle == 0:
            yield start, i, body[start:i].strip()
            start = i + 1


def main() -> int:
    parser = argparse.ArgumentParser(description='Generate a mechanical inventory of TypeScript interface methods.')
    parser.add_argument('--api', required=True, help='Path to workshop-shared/src/api.ts')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    source = Path(args.api).resolve()
    text = mask_comments(source.read_text(encoding='utf-8'))
    rows = []
    for match in INTERFACE_RE.finditer(text):
        name, extends = match.group(1), match.group(2).strip()
        open_pos = text.find('{', match.start())
        close_pos = find_matching_brace(text, open_pos)
        raw_body = text[open_pos + 1:close_pos]
        body = strip_comments(raw_body)
        body_absolute_start = open_pos + 1
        for start, end, statement in top_level_statements(body):
            normalized = ' '.join(statement.split())
            method = re.match(r'^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(?:<.*?>)?\s*\(', normalized)
            if not method:
                continue
            rows.append({
                'interface': name,
                'extends': extends,
                'method': method.group(1),
                'signature': normalized,
                'source_path': str(source),
                'source_line': line_of(text, body_absolute_start + start),
                'rpc_candidate': 'RpcTarget' in extends or name in {'AdminApi', 'GatekeeperClient', 'GadgetClient', 'WorkpieceClient'},
                'review_status': 'mechanical-needs-manual-review',
            })

    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ['interface', 'extends', 'method', 'signature', 'source_path', 'source_line', 'rpc_candidate', 'review_status']
    with output.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(f'Wrote {len(rows)} mechanical method rows to {output}')
    print('Manual review is required for RPC capability coverage, overloads, callbacks, and parser edge cases.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
