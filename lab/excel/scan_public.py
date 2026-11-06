"""Scan Git's public candidate files using runtime identities; never print tokens."""
import io
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCOPES = ('lab', 'public', 'docs', 'scripts', 'tests')


def matches(raw, tokens):
    texts = [raw.decode(encoding, errors='ignore').casefold() for encoding in ('utf-8', 'utf-16le')]
    hits = set()
    for category, values in tokens.items():
        for value in values:
            pattern = re.compile(r'(?<!\w)' + re.escape(value.casefold()) + r'(?!\w)') if category == 'pid' else None
            if any(pattern.search(text) if pattern else value.casefold() in text for text in texts):
                hits.add(category)
    return hits


def runtime_tokens():
    tokens = {key: {os.environ[key]} if os.environ.get(key) else set() for key in ('COMPUTERNAME', 'USERNAME')}
    tokens.update(printer=set(), pid=set())
    for path in (ROOT / 'lab/excel/cases').glob('*/owned-process.json'):
        record = json.loads(path.read_text(encoding='utf-8-sig'))
        tokens['pid'].update(str(v) for k, v in record.items() if k in ('pid', 'runner_pid') and v)
    printers = subprocess.run(['powershell.exe', '-NoProfile', '-Command',
        '[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); @(Get-CimInstance Win32_Printer | ForEach-Object { $_.Name }) | ConvertTo-Json -Compress'],
        capture_output=True, check=True).stdout.decode('utf-8-sig').strip()
    names = json.loads(printers) if printers else []
    if isinstance(names, str):
        names = [names]
    for path in (ROOT / 'lab/excel/cases').glob('*/result.json'):
        printer = json.loads(path.read_text(encoding='utf-8-sig')).get('environment', {}).get('printer')
        if printer:
            names.append(printer)
    for name in names:
        tokens['printer'].add(name)
        # Excel's ActivePrinter includes a port prefix; also scan the actual model.
        model = name.split('에 있는 ')[-1].removeprefix('Fax - ')
        if model:
            tokens['printer'].add(model)
    return tokens


def main():
    tokens = runtime_tokens()
    listed = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', *SCOPES],
                            cwd=ROOT, capture_output=True, check=True).stdout
    candidates = sorted(set(p.decode('utf-8') for p in listed.split(b'\0') if p))
    findings = []
    unreadable = []
    scanned = members = 0
    for name in candidates:
        path = ROOT / name
        if not path.is_file():
            continue
        try:
            raw = path.read_bytes()
        except OSError:
            unreadable.append(name)
            continue
        hits = matches(raw, tokens) | matches(name.encode('utf-8'), tokens)
        if zipfile.is_zipfile(io.BytesIO(raw)):
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                for part in archive.infolist():
                    hits |= matches(archive.read(part), tokens)
                    members += 1
        scanned += 1
        if hits:
            findings.append({'file': name, 'categories': sorted(hits)})
    print(json.dumps({'scanned_files': scanned, 'archive_members': members,
                      'runtime_token_counts': {k: len(v) for k, v in tokens.items()},
                      'findings': findings, 'unreadable_files': unreadable}, ensure_ascii=False, indent=2))
    return bool(findings or unreadable)


if __name__ == '__main__':
    raise SystemExit(main())
