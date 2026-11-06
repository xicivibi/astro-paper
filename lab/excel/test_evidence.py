import json
import tempfile
import unittest
from pathlib import Path

from sanitize_public import clean_value
from verify_runs import read
from rasterize import render
from scan_public import matches
import pymupdf
from PIL import Image


class EvidenceTests(unittest.TestCase):
    def test_scan_handles_case_utf16_and_pid_word_boundaries_without_printing_tokens(self):
        tokens = {'USERNAME': {'InventedUser'}, 'pid': {'12345'}, 'printer': {'Invented printer'}}
        for encoding in ('utf-8', 'utf-16le'):
            self.assertEqual(matches('inventeduser 12345 INVENTED PRINTER'.encode(encoding), tokens), set(tokens))
        self.assertEqual(matches(b'abc12345def 123456', tokens), set())

    def test_sanitizer_removes_machine_metadata_and_preserves_cleanup_verification(self):
        source = {'environment': {'printer': 'synthetic printer', 'synthetic': True},
                  'cleanup': {'owned_pid': 123, 'owned_start_time': 'private', 'owned_process_remaining': False},
                  'retired_instances': [{'pid': 456, 'owned_process_remaining': False}], 'steps': [1]}
        self.assertEqual(clean_value(source), {'environment': {'synthetic': True}, 'cleanup_verified': True, 'steps': [1]})
        source['cleanup']['source_csv_restored'] = False
        self.assertFalse(clean_value(source)['cleanup_verified'])

    def test_public_result_rejects_printer_or_cleanup_keys_at_any_depth(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.json'
            for value in ({'environment': {'printer': 'synthetic'}}, {'cleanup': {}}, {'steps': [{'printer': 'synthetic'}]}):
                path.write_text(json.dumps(value), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'Private metadata'):
                    read(path)

    def test_rejects_literal_and_escaped_replacement_characters(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.json'
            for ascii_only in (False, True):
                path.write_text(json.dumps({'message': '\ufffd'}, ensure_ascii=ascii_only), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, r'U\+FFFD'):
                    read(path)

    def test_korean_survives_json_and_path_sanitizing(self):
        message = "- 연산자를 형식 Text 및 Text에 적용할 수 없습니다."
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.json'
            path.write_bytes(json.dumps({'message': message}, ensure_ascii=False).encode('utf-8'))
            self.assertEqual(read(path)['message'], message)
        self.assertEqual(clean_value(message), message)
        self.assertEqual(clean_value('파일 C:\\Users\\invented\\lab\\excel\\cases\\sample\\source.csv'), '파일 샘플폴더/source.csv')

    def test_pdf_rasterization_rejects_blank_and_private_text(self):
        with tempfile.TemporaryDirectory() as directory:
            for text in ('', 'C:\\Users\\private\\account'):
                source = Path(directory) / 'input.pdf'
                with pymupdf.open() as pdf:
                    page = pdf.new_page()
                    if text:
                        page.insert_text((40, 40), text)
                    pdf.save(source)
                with self.assertRaisesRegex(ValueError, 'Blank|Private'):
                    render(source, Path(directory) / 'output.png')

    def test_pdf_rasterization_produces_cropped_nonblank_small_png(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = [Path(directory) / name for name in ('input.pdf', 'output.png')]
            with pymupdf.open() as pdf:
                page = pdf.new_page()
                page.insert_text((40, 40), 'Synthetic Amount 123')
                pdf.save(source)
            meta = render(source, target)
            with Image.open(target) as image:
                self.assertGreater(len(image.getcolors(image.width * image.height)), 1)
                self.assertLess(image.width, 1190)
            self.assertLess(target.stat().st_size, 300_000)
            self.assertTrue(meta['pdf_text_checked'])

    def test_split_pdf_preserves_both_pages_and_checks_each_page(self):
        with tempfile.TemporaryDirectory() as directory:
            source, target = [Path(directory) / name for name in ('input.pdf', 'output.png')]
            with pymupdf.open() as pdf:
                for text in ('Synthetic first columns', 'Synthetic split columns'):
                    pdf.new_page().insert_text((40, 40), text)
                pdf.save(source)
            self.assertEqual(render(source, target)['pdf_pages'], 2)
            private = Path(directory) / 'private.pdf'
            with pymupdf.open() as pdf:
                pdf.new_page().insert_text((40, 40), 'Synthetic first columns')
                pdf.new_page().insert_text((40, 40), 'C:\\Users\\private\\account')
                pdf.save(private)
            before = target.read_bytes()
            with self.assertRaisesRegex(ValueError, 'Private'):
                render(private, target)
            self.assertEqual(target.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
