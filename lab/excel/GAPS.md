# Excel evidence gaps: verified 2026-11-07

Both final real `run-all` invocations passed 15/15: `gap-verified-first-20261107` and `gap-verified-second-20261107`. `verify_runs.py` found all observations identical, including complete steps, M/formulas, results, reconciliations, assertions, limitations and PNG hashes/validation metadata. Timestamps, xlsx container hashes and process identities are excluded; deterministic fixtures are checked separately.

The original 15 result files were copied first to `runs/gap-baseline-20261107/`. The full data comparison is in `runs/baseline-comparison.json`: **0 changed observed values**. No case/field/old/new data rows exist. All original assertions and non-capture limitations also match. Each case intentionally gains two PNG records and one capture assertion, and loses two obsolete capture-failure notes. Workbook containers and execution metadata were regenerated.

The earlier diagnostic full run (`gap-first-20261107`) exposed an oversized tall PNG and the print-area case’s actual two-page PDF. Both were fixed before the two final full runs; diagnostic failures were retained.

## Encoding

No U+FFFD existed in any original JSON, decoded JSON string, or sanitizer source. The example group error was already correct Unicode on disk. The reproducible boundary was Python piped stdout using CP949 while the tool reader interpreted bytes as UTF-8; the same text printed correctly with `PYTHONIOENCODING=utf-8`. PowerShell scripts already had UTF-8 BOMs and `Write-Json` already wrote UTF-8. The source now fixes console/pipe/Python encodings explicitly. The verifier rejects both literal and JSON-escaped U+FFFD in current results and selected run archives. No native error message was reconstructed or substituted.

Exact observed messages follow, with the folder portion removed. The other nine cases record no localized error message.

| Case | Exact message (folder removed) |
| --- | --- |
| `csv-date-day-month-swap-checklist` | `Date 값에 제공된 입력을 구문 분석할 수 없습니다.` |
| `csv-decimal-thousands-separator` | `Number로 변환할 수 없습니다.` |
| `power-query-csv-date-using-locale` | `Date 값에 제공된 입력을 구문 분석할 수 없습니다.` |
| `power-query-group-by-subtotal` | `- 연산자를 형식 Text 및 Text에 적용할 수 없습니다.` |
| `power-query-refresh-file-path-error` | `File or Folder: 'source.csv' 파일을 찾을 수 없습니다.`<br>`[DataSource.NotFound] File or Folder: 'source.csv' 파일을 찾을 수 없습니다.` |
| `power-query-type-change-error-rows` | `Number로 변환할 수 없습니다.` |

## Native images

Working method: native Excel `Range.ExportAsFixedFormat`, then installed PyMuPDF 2.0 and Pillow 12.2.0. The print-area case uses its actual exported PDFs; split pages are placed side by side in page order. Other cases capture actual wrong and fixed worksheet/query ranges, restoring print settings afterward. The missing-file image excludes path-bearing Message/Detail cells; the privacy case shows only invented fixture identities. Native PDFs were inspected and use Hanjin Group Sans.

Clipboard preservation preflight failed before any CopyPicture or visible-window operation. Three later read-only retries also failed. Because the clipboard could not be saved/restored safely, requested methods 1 and 2 remain unverified. **The user clipboard was never modified; no desktop focus or screen capture was used.** The PDF method completes the image deliverable without that dependency.

All 30 public PNGs were checked for multiple pixel colors, native-PDF text privacy, metadata absence, size and hashes, and visually reviewed in three contact boards. Both runs produced identical PNG hashes. The largest is **273,349 bytes**, strictly below 300,000 bytes. All 30 are unignored; no .gitignore exception was necessary. Palette reduction preserves dimensions for the tall images.

| Case | Before | After |
| --- | --- | --- |
| `power-query-unpivot-monthly-columns` | [PNG, 30,602 bytes](cases/power-query-unpivot-monthly-columns/before.png) | [PNG, 273,349 bytes](cases/power-query-unpivot-monthly-columns/after.png) |
| `power-query-split-column-delimiter` | [PNG, 13,865 bytes](cases/power-query-split-column-delimiter/before.png) | [PNG, 15,111 bytes](cases/power-query-split-column-delimiter/after.png) |
| `power-query-group-by-subtotal` | [PNG, 10,440 bytes](cases/power-query-group-by-subtotal/before.png) | [PNG, 11,242 bytes](cases/power-query-group-by-subtotal/after.png) |
| `power-query-fill-down-merged-cells` | [PNG, 18,742 bytes](cases/power-query-fill-down-merged-cells/before.png) | [PNG, 31,648 bytes](cases/power-query-fill-down-merged-cells/after.png) |
| `power-query-type-change-error-rows` | [PNG, 10,709 bytes](cases/power-query-type-change-error-rows/before.png) | [PNG, 13,387 bytes](cases/power-query-type-change-error-rows/after.png) |
| `power-query-merge-key-whitespace` | [PNG, 35,760 bytes](cases/power-query-merge-key-whitespace/before.png) | [PNG, 26,678 bytes](cases/power-query-merge-key-whitespace/after.png) |
| `power-query-refresh-file-path-error` | [PNG, 8,605 bytes](cases/power-query-refresh-file-path-error/before.png) | [PNG, 11,348 bytes](cases/power-query-refresh-file-path-error/after.png) |
| `csv-date-day-month-swap-checklist` | [PNG, 58,653 bytes](cases/csv-date-day-month-swap-checklist/before.png) | [PNG, 49,795 bytes](cases/csv-date-day-month-swap-checklist/after.png) |
| `csv-decimal-thousands-separator` | [PNG, 51,562 bytes](cases/csv-decimal-thousands-separator/before.png) | [PNG, 39,653 bytes](cases/csv-decimal-thousands-separator/after.png) |
| `csv-quoted-newline-row-break` | [PNG, 23,708 bytes](cases/csv-quoted-newline-row-break/before.png) | [PNG, 21,652 bytes](cases/csv-quoted-newline-row-break/after.png) |
| `excel-text-stored-numbers-convert` | [PNG, 12,042 bytes](cases/excel-text-stored-numbers-convert/before.png) | [PNG, 13,118 bytes](cases/excel-text-stored-numbers-convert/after.png) |
| `excel-duplicate-key-before-vlookup` | [PNG, 24,915 bytes](cases/excel-duplicate-key-before-vlookup/before.png) | [PNG, 21,056 bytes](cases/excel-duplicate-key-before-vlookup/after.png) |
| `excel-pdf-export-print-area-check` | [PNG, 54,915 bytes](cases/excel-pdf-export-print-area-check/before.png) | [PNG, 17,466 bytes](cases/excel-pdf-export-print-area-check/after.png) |
| `csv-export-personal-data-column-check` | [PNG, 61,286 bytes](cases/csv-export-personal-data-column-check/before.png) | [PNG, 7,597 bytes](cases/csv-export-personal-data-column-check/after.png) |
| `power-query-csv-date-using-locale` | [PNG, 58,779 bytes](cases/power-query-csv-date-using-locale/before.png) | [PNG, 49,683 bytes](cases/power-query-csv-date-using-locale/after.png) |

`signing-kit.mjs` copies only before/after PNGs with a matching validated privacy-check hash into `expected/`, as binary `image/png` resources. Their hashes participate in the deterministic manifest. Textual/unknown PNG metadata, stale validation, trailing bytes and oversized PNGs are refused. Compressed pixels are treated as binary rather than path text, matching the existing XLSX structural-inspection approach; a regression test covers accidental path-like pixel bytes.

## Verification

`python -m unittest discover -s lab/excel -p test_evidence.py`: 5 tests passed. `npm test`: 149 passed, 0 failed. Targeted ESLint, formatting and git whitespace checks passed. The process audit checked 111 recorded owned Excel identities (including history), with 0 remaining. Ownership/PID/start-time protection was preserved. No user Excel instance was attached to or closed.

All 15 real sign-post dry-runs passed: 14 with `--name "테스트필명" --dry-run`; `power-query-csv-date-using-locale` with `--kit-only --dry-run`. No real kit or post was published. All 42 protected post/draft files retain their original hashes. No commit, push, deployment, other agent, new dependency or account connection was performed.

The final explicit sanitizer pass and a repeat of those 15 dry-runs are performed after this report is written. Run archives store sanitized final JSON so recorded input workbook hashes match the sanitized workbook; sanitization failures now fail run-all.

Exact requested test command and output:

```text
node --experimental-strip-types --test tests/sign-post.test.ts tests/reproduction-kit.test.ts
✔ published reproduced guides bind to valid content-addressed kits (7.6689ms)
✔ official-source-only guide does not claim a reproduction kit (0.251ms)
✔ reproduction kit UI remains static and account-free (0.4834ms)
✔ native before/after PNGs are expected binary resources bound to deterministic hashes (56.0913ms)
✔ PNG publication refuses unverified captures, identity metadata and oversized assets (163.6487ms)
✔ validated PNG pixel bytes are binary, and changing the image changes the kit hash (19.7476ms)
✔ refuses absent, empty, placeholder and machine signers without writing (685.3134ms)
✔ refuses published, signed, held or unfinished drafts and body leaks (720.0709ms)
✔ quality-gate failures and unsuccessful or stale evidence are all or nothing (372.2291ms)
✔ fails closed on paths and owned-process values in any public payload (417.4768ms)
✔ signs with KST metadata, preserves unrelated front matter and every body byte, and passes existing kit validation (60.5988ms)
✔ same inputs produce a deterministic kit hash regardless of signing name or result key order (120.2382ms)
✔ note inserts exactly one paragraph after the first prose paragraph, leaving every existing byte (65.8565ms)
✔ dry run validates and describes changes without even creating temporary files (71.1159ms)
✔ rolling pace is half-open [start, start + 7 days), including later scheduled posts (0.3854ms)
✔ kit-only adds only reproductionKit to a published post, keeping unsigned fields untouched (108.4807ms)
✔ status lists drafts, published and scheduled posts with evidence, length and reused threshold (145.1724ms)
✔ invalid CLI combinations, slug traversal and invalid dates refuse without writes (398.8346ms)
✔ inspects compressed XLSX metadata and publishes only the synthetic input workbook (205.6829ms)
✔ note skips a complete fenced block and heading before the first paragraph (106.7795ms)
✔ refuses local identity in unchanged front matter or signer (100.7959ms)
✔ ordinary HTTPS links are not local paths (100.0518ms)
✔ failed final post move restores pending and removes only the staged kit (63.783ms)
✔ LF posts without a BOM preserve body bytes and an existing kit toolPath (83.2671ms)
✔ exactly seven days minus one millisecond remains inside the pace window (0.2312ms)
✔ kit-only preserves an existing human signature verbatim (101.2473ms)
✔ a conflicting existing kit fails even in dry-run and preserves sibling kits (61.1561ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4424.6921
```

## Tools and limits

| Candidate | State and decision |
| --- | --- |
| Excel COM / Windows PowerShell 5.1 / .NET | Installed, called and verified against native observations; reused ownership-safe automation. No additional cost/account/permission. |
| Python / PyMuPDF / Pillow | Already installed, called and verified; chosen renderer and pixel/privacy audit. No installation or service. |
| Existing signer / kit / Node tests | Called and verified; extended only for PNG integration and regression tests. Actual project signing used dry-run only. |
| CopyPicture screen/bitmap and printer/picture | Clipboard preflight unavailable; not executed to avoid replacing unsaved user clipboard content. |
| Edge headless | Additional renderer candidate, not probed/called because installed Python rendering worked. |
| pywin32 | Not installed; unnecessary beside existing PowerShell COM. Not installed for this task. |
| Live Excel add-in / document connectors | Connection state not tested; not called because the user workbook must remain untouched. |
| Other agents/model APIs | Explicitly excluded by the user; none called. |

No site UI, content editing or actual deployment is required for this lab change. Remaining limits: clipboard-dependent methods 1–2, physical printing, other Excel versions/locales, ribbon-click equivalence and human editorial approval remain unverified. The requested PNG fallback, observed-value comparison and signing dry-runs are complete.

API references: [Range.CopyPicture](https://learn.microsoft.com/en-us/office/vba/api/excel.range.copypicture), [Range.ExportAsFixedFormat](https://learn.microsoft.com/en-us/office/vba/api/excel.range.exportasfixedformat).
