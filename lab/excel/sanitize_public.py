"""Remove machine paths and the author's name from lab outputs that become public kits.

Excel writes the save folder into xl/workbook.xml and the Office account name into
docProps/core.xml. Run after run-all; run-all.ps1 calls it. Cell data is not touched,
which main() confirms by comparing every worksheet part before and after.
"""
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
ABS_PATH = re.compile(r'<mc:AlternateContent[^>]*>(?:(?!</mc:AlternateContent>).)*?absPath(?:(?!</mc:AlternateContent>).)*?</mc:AlternateContent>', re.S)
LOCAL_DIR = re.compile(r'[A-Za-z]:[\\/]+Users[\\/]+[^"\'\s]*?[\\/]+lab[\\/]+excel[\\/]+cases[\\/]+[^\\/"\'\s]+[\\/]*', re.I)
OTHER_LOCAL = re.compile(r'[A-Za-z]:[\\/]+Users[\\/]+[^"\'\s]*', re.I)


def clean_core(xml: str) -> str:
    xml = re.sub(r'<dc:creator>[^<]*</dc:creator>', '<dc:creator></dc:creator>', xml)
    xml = re.sub(r'<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', '<cp:lastModifiedBy></cp:lastModifiedBy>', xml)
    return re.sub(r'(<dcterms:(?:created|modified)[^>]*>)[^<]*', r'\g<1>2026-01-01T00:00:00Z', xml)


def clean_workbook(raw: bytes) -> bytes:
    before = {}
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(raw)) as source, zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            data = source.read(item.filename)
            if item.filename.startswith('xl/worksheets/') or item.filename == 'xl/sharedStrings.xml':
                before[item.filename] = data
            elif item.filename == 'xl/workbook.xml':
                data = ABS_PATH.sub('', data.decode('utf-8')).encode('utf-8')
            elif item.filename == 'docProps/core.xml':
                data = clean_core(data.decode('utf-8')).encode('utf-8')
            info = zipfile.ZipInfo(item.filename, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0
            target.writestr(info, data)
    with zipfile.ZipFile(io.BytesIO(output.getvalue())) as check:
        for name, data in before.items():
            assert check.read(name) == data, f'{name} changed'
        for name in ('xl/workbook.xml', 'docProps/core.xml'):
            text = check.read(name).decode('utf-8')
            assert 'absPath' not in text and not re.search(r'<dc:creator>[^<]+', text), f'{name} still identifies the machine'
    return output.getvalue()


def clean_value(value):
    if isinstance(value, str):
        # The regex text in the PDF page-count note reads like a UNC path to the leak check.
        value = re.sub(r'/Type\\+s\*/Page\\+b', '/Type /Page', value)
        value = LOCAL_DIR.sub('샘플폴더/', value).replace('C:\\샘플\\', '샘플폴더/')
        return OTHER_LOCAL.sub('샘플폴더/파일', value)
    if isinstance(value, list):
        return [clean_value(item) for item in value]
    if isinstance(value, dict):
        cleaned = {key: clean_value(item) for key, item in value.items()
                   if key not in ('printer', 'cleanup', 'retired_instances')}
        if 'cleanup' in value:
            cleanup = value['cleanup'] or {}
            cleaned['cleanup_verified'] = (
                cleanup.get('owned_process_remaining') is False
                and cleanup.get('source_csv_restored') is not False
                and all(p.get('owned_process_remaining') is False for p in value.get('retired_instances', [])))
        return cleaned
    return value


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    cases = sorted(p for p in (HERE / 'cases').iterdir() if p.is_dir())
    changed = 0
    for case in cases:
        result_path = case / 'result.json'
        result = json.loads(result_path.read_text(encoding='utf-8-sig'))
        book = case / 'input.xlsx'
        if book.is_file():
            cleaned = clean_workbook(book.read_bytes())
            book.write_bytes(cleaned)
            result.setdefault('input_sha256', {})['input.xlsx'] = hashlib.sha256(cleaned).hexdigest()
        cleaned_result = clean_value(result)
        result_path.write_text(json.dumps(cleaned_result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        for name in ('query.m', 'fixed.m'):
            path = case / name
            if path.is_file():
                assert 'Users\\' not in path.read_text(encoding='utf-8-sig'), f'{path} holds a local path'
        changed += 1
    print(f'{changed} cases sanitized')
    return 0


if __name__ == '__main__':
    sys.exit(main())
