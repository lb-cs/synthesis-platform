# PDF text extraction spike (CECS491-56)

## Recommendation

Use **PyMuPDF** for the worker's first PDF text extraction pass. Iterate pages in order and store each extracted page with the one-based page number. It was the fastest candidate in this sample and returned readable text. Revisit OCR as a separate requirement: text extraction alone does not recover text from image-only scans.

## Sample and method

- Sample: `lm-info.pdf`, a 26-page Latin Modern font technical manual available from [TeX Live's historic archive](https://ftp.math.utah.edu/pub/texlive/historic/fonts/latin-modern/lm-2.004/lm-info.pdf). The local TeX Live copy was used for the run.
- File size: 900,836 bytes.
- Compared PyMuPDF 1.26.6, pypdf 6.10.0, and pdfplumber 0.11.9.
- Timed one extraction pass, including opening the PDF. Each library produced one text string per page; the page list length preserves the page mapping.

## Results

| Library | Pages | Extracted characters | Elapsed |
| --- | ---: | ---: | ---: |
| PyMuPDF | 26 | 52,292 | 109 ms |
| pypdf | 26 | 53,646 | 798 ms |
| pdfplumber | 26 | 54,710 | 2,465 ms |

All three preserved the 26-page boundary when called once per page. PyMuPDF's first-page text read cleanly. pypdf's output was similar but introduced extra spaces in some words. pdfplumber was slowest and produced a scrambled line for one decorative text element. These are qualitative observations from one sample, not a broad corpus benchmark.

## Trade-offs

- **PyMuPDF**: best fit for the worker's simple page-numbered text extraction. The library documents `page.get_text("text")` and OCR support via Tesseract for image-based pages; OCR adds a system dependency and is outside the MVP path.
- **pypdf**: pure-Python alternative with a simple page API, but it was about 7.3× slower on this file. Its documentation also states that it does not perform OCR.
- **pdfplumber**: useful when character positions and layout inspection matter; that is not needed for the first page-numbered chunking pass, and it was about 22.6× slower here.

## Reproduction

```python
from pathlib import Path
from time import perf_counter

import fitz
import pdfplumber
from pypdf import PdfReader

pdf = Path("lm-info.pdf")
candidates = {
    "PyMuPDF": lambda: [page.get_text("text") for page in fitz.open(pdf)],
    "pypdf": lambda: [page.extract_text() or "" for page in PdfReader(pdf).pages],
    "pdfplumber": lambda: [page.extract_text() or "" for page in pdfplumber.open(pdf).pages],
}

for name, extract in candidates.items():
    started = perf_counter()
    pages = extract()
    elapsed_ms = (perf_counter() - started) * 1_000
    print(name, len(pages), sum(map(len, pages)), round(elapsed_ms))
```

Sources: [PyMuPDF text extraction](https://pymupdf.readthedocs.io/en/latest/the-basics.html), [PyMuPDF OCR notes](https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html), [pypdf extraction limitations](https://pypdf.readthedocs.io/en/latest/user/extract-text.html), [pdfplumber](https://github.com/jsvine/pdfplumber).
