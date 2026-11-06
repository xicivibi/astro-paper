"""Rasterize only native Excel range PDFs; never capture the desktop."""
import json
import io
import os
import re
import sys
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageChops


def render(source, target):
    images = []
    with fitz.open(source) as pdf:
        if not 1 <= len(pdf) <= 20:
            raise ValueError('Unexpected PDF page count')
        for page in pdf:
            text = page.get_text()
            names = [os.environ.get('USERNAME'), os.environ.get('USER')]
            if re.search(r'[a-z]:[\\/]|\\\\|/(?:Users|home)/', text, re.I) or any(
                    name and name.lower() in text.lower() for name in names):
                raise ValueError('Private/local identity in rendered PDF text')
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            box = ImageChops.difference(image, Image.new('RGB', image.size, 'white')).getbbox()
            if box is None:
                raise ValueError('Blank PDF')
            images.append(image.crop((max(0, box[0]-8), max(0, box[1]-8), min(image.width, box[2]+8), min(image.height, box[3]+8))))
    image = Image.new('RGB', (sum(item.width for item in images) + 16*(len(images)-1), max(item.height for item in images)), 'white')
    left = 0
    for item in images:
        image.paste(item, (left, 0))
        left += item.width + 16
    colors = image.getcolors(image.width * image.height)
    if colors is None or len(colors) <= 1:
        raise ValueError('Blank image')
    output = io.BytesIO()
    image.save(output, format='PNG', optimize=True)
    if output.tell() >= 300_000:
        image = image.quantize(colors=256)
        colors = image.getcolors(image.width * image.height)
        output = io.BytesIO()
        image.save(output, format='PNG', optimize=True)
    if output.tell() >= 300_000:
        raise ValueError('PNG exceeds 300 KB')
    Path(target).write_bytes(output.getvalue())
    return dict(width=image.width, height=image.height, distinct_colors=len(colors), pdf_text_checked=True, pdf_pages=len(images))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(render(sys.argv[1], sys.argv[2])))
