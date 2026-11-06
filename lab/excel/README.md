# Xici real Excel reproduction lab

All source data in this folder is deliberately invented. No real person or company
is represented. Nothing in this lab publishes or edits a post. Only this folder
is written. Run this on Windows with desktop Excel 16 and Windows PowerShell 5.1.
No new dependency, account, subscription or external service is needed.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lab/excel/run-all.ps1 -RunLabel first
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lab/excel/run-all.ps1 -RunLabel second
python lab/excel/verify_runs.py first second
powershell.exe -NoProfile -ExecutionPolicy Bypass -File lab/excel/verify_processes.ps1
python lab/excel/write_report.py
```

Each `cases/<slug>/run.ps1` also runs independently. `build_input.ps1` materializes
its input workbook using Excel, without claiming to have run the procedure.
`prepare_lab.py` recreates the small deterministic JSON/CSV fixtures, query
templates and entry points; it does not produce observations. It is not needed
to run the checked-in case definitions. Do not run it to overwrite fixture edits
you want to retain. Generated xlsx ZIP/container metadata can change between runs;
the JSON/CSV contents and the actual cell observations are deterministic.

## Implementation and safety

`runner.ps1`, `common.ps1` and `procedures.ps1` are the implementation. Each child
runner creates a **new, hidden** Excel application, sets `DisplayAlerts=false`,
disables macro execution in files it opens, records the window's PID and start
time, and refuses a PID that existed before creation. `finally` closes its own
workbook, quits its application, releases tracked COM objects in reverse order
and runs finalizers. If COM leaves that owned process running, only the recorded
PID with the same start time is stopped. `GetActiveObject` and process-name
termination are never used. Existing Excel processes are never closed.

`run-all.ps1` runs children sequentially and continues after case failures. It
enforces a per-case timeout, with the same child/PID/start-time ownership check.
`summary.json` records statuses and reasons. `runs/<label>/` retains exact result
JSON and stdout/stderr from each invocation. Timeouts or assertion failures are
failures, never converted to successful experiments.

Power Query is evaluated by `Workbook.Queries.Add`, an actual
`Microsoft.Mashup.OleDb.1` connection and Excel ListObject, with
`BackgroundQuery=false` and `QueryTable.Refresh(false)`. Cells are read back only
after refresh. Every step records its exact resolved M/formula and observed
values, displayed strings, and Excel error-cell codes. M `try` diagnostics preserve
underlying error messages; COM failures preserve the full exception/HRESULT chain.
The missing-file diagnostic forces `File.Contents` through `Binary.Buffer` and
`Binary.Length`: merely wrapping the lazy binary in `try` can report `HasError=false`
without reading the missing file. The refresh COM error is recorded independently.

`input.json` and committed `source.csv` files define the fixtures; `input.xlsx`
is the initial workbook produced by Excel. `evidence.xlsx` retains query outputs
and formulas after the run. The merged-cell case reads its actual saved xlsx
through `Excel.Workbook`, and separately injects a literal M empty string to avoid
pretending that a genuinely blank Excel cell and an M empty string are identical.
The missing-path case temporarily renames **its own synthetic CSV** and restores
it in `finally`; no unrelated file is moved or deleted. Because this Excel build
holds the CSV even after closing its workbook, the case quits and releases its
first owned Excel instance, renames the file and opens the saved query workbook
in a new hidden instance. Both owned PIDs are retained in the evidence.
Its cached `evidence.xlsx` records the temporary renamed path that succeeded
during the experiment; that path is restored afterward. Reproduce this case with
`run.ps1`, rather than assuming a later manual Refresh All uses the temporary path.

Assertions enforce fixture integrity, retained row counts and reconciliations.
`expectations` checks the brief's hypothesized behavior; a different real Excel
outcome is retained in `differences_from_brief`, rather than fabricated or discarded.
Some assertion constants describe intentional input values, never substituted
observations. Korean numerical statements are built from Excel readbacks and
their derived counts/totals. `wrong_result` and `fixed_result` are evidence records,
not universal recommendations: the mixed-format decimal column is corrected using
the explicitly declared synthetic `SourceLocale` for each row, without guessing
the locale from ambiguous punctuation; duplicate price selection uses an explicitly
invented approved unique-key table, not an arbitrary first/last policy.

## Images and PDFs

The capture investigation first tried to materialize the clipboard before using
visible/minimized Excel with `CopyPicture` and chart export. Windows denied
`Clipboard.GetDataObject` in this execution session. Neither screen nor printer
`CopyPicture` was safe to execute without a backup; neither was executed and the
clipboard was untouched. No visible Excel window or desktop capture was used.

The working method is native `Range.ExportAsFixedFormat` to a one-page PDF,
followed by the already-installed PyMuPDF and Pillow. It captures actual wrong and
fixed query/worksheet ranges after observation, not a re-created HTML table. The
print-area case rasterizes its actual partial-area and fitted native PDF exports.
Split PDF pages are cropped individually and placed left to right in page order;
no page is silently discarded.
Print settings changed for range capture are restored before saving evidence.
The missing-file image includes HasError/Reason only, excluding the path-bearing
Message/Detail columns. The CSV privacy case temporarily shows its synthetic
hidden columns for the before image and restores their hidden state afterward.

`rasterize.py` checks the PDF's rendered text for local paths/user identity, crops
white margins, rejects blank images and writes only PNGs smaller than 300,000
bytes. Large PNGs use a 256-color palette without reducing dimensions. Each result
records the source sheet/range, dimensions, colors, bytes and SHA-256. PNGs contain
only sheet content, no window frame or document metadata. Both images are required
for a passing case. `signing-kit.mjs` includes only validated before/after PNGs as
binary `image/png` expected resources, rejects metadata chunks and stale hashes,
and incorporates their hashes into the deterministic kit manifest.

`sanitize_public.py` removes `environment.printer`, `cleanup` and
`retired_instances` from each on-disk case result, retaining only
`cleanup_verified` for the cleanup/restoration outcome. Process ownership records
and archived raw runs remain ignored local safety evidence. They are never kit
resources. `verify_runs.py` rejects private metadata keys in public results;
`scan_public.py` scans tracked and non-ignored candidate files in `lab/`,
`public/`, `docs/`, `scripts/` and `tests/`, including XLSX members, against runtime
printer names, owned PIDs, COMPUTERNAME and USERNAME without printing the values.
Python bytecode caches are ignored because their code filenames contain local paths.

Draft captures stay under `lab/excel/cases/`. When a post references lab images,
`sign-post` requires both validated PNGs and stages them with its kit and post,
then copies them to `public/images/excel-lab/<slug>/`. Any write failure rolls back
new images and the kit. `--dry-run` lists both destinations without writing;
`--kit-only` follows the same image rules. Existing differing public images are
rejected. Images enter the next deployment bundle after signing, including for
posts scheduled for a later publication time.

PowerShell and Python child output explicitly use UTF-8. In the gap investigation,
all 15 existing JSON files already preserved their Korean messages: Python's
default piped stdout was CP949, which the tool boundary read as UTF-8. Setting
`PYTHONIOENCODING=utf-8` reproduced the same messages correctly without changing
any JSON bytes. `verify_runs.py` rejects U+FFFD in current case results and in both
archived runs, including JSON-escaped replacement characters. Regression checks:

```powershell
python -m unittest discover -s lab/excel -p test_evidence.py
```

The print-area experiment produces three native Excel PDFs. It counts uncompressed
`/Type /Page` objects (excluding `/Pages`) and reads Excel's actual page breaks
after export. This supports page/column-split findings, not a claim of visual PDF
readability or physical printer testing.

CSV direct open uses `Workbooks.Open(..., ReadOnly=true, Local=true)`, with no forced
date conversion. The result records Excel's own numeric/text values and display.
The hidden-column experiment exports the active worksheet via `xlCSVUTF8`, reads
the bytes, reopens the exported CSV in Excel and compares it with an allowlist-only
export. `example.invalid`, `000-0000-*` and the hidden-sheet marker are invented.

## Tools considered

| Tool | State and decision |
| --- | --- |
| Desktop Excel COM | Installed and callable in initial probe; real case validation is in result JSON. Chosen for native Power Query, formula, CSV and PDF behavior. |
| Windows PowerShell 5.1/.NET | Installed/callable; chosen for native COM, UTF-8 output, hashing and process ownership checks. |
| Existing project Python | Callable; JSON comparison, privacy checks and native PDF rasterization. pywin32 absent, so not installed. |
| PyMuPDF 2.0 / Pillow 12.2 | Already installed, called and verified for nonblank cropped PNGs; no account/network/dependency installation. |
| Edge headless (additional candidate) | Not called: installed Python rasterization worked; a second renderer adds no benefit. |
| Excel/Spreadsheets skills | Reviewed routing and verification guidance; explicit user COM/hidden-instance requirements govern this lab. Artifact workbook emulation and the live add-in route cannot replace the requested native experiments. |
| Connected Excel add-in/document tools | Available capability candidates; account/session connection not tested. Excluded because no live user workbook should be touched and COM is explicitly requested. |
| Google Sheets/Drive, artifact-tool, openpyxl | No equivalent native Excel/PQ/export validation; excluded. Connection/installation was not claimed or changed. |
| pywin32 (additional candidate) | Absent; PowerShell already provides the required API, so no dependency installation. |
| pypdf (additional candidate) | Absent; the requested PDF page-object count plus Excel page breaks requires no installation. |
| Existing reproduction kit scripts | Reused and extended for hashed, privacy-checked PNG resources; sign-post is validated only with dry-run. |
| Microsoft Learn / official VBA examples | Read-only references for the native query refresh contract and reusable M operations; no downloaded automation or third-party execution. |
| Agents and external model APIs | Excluded by the user's instruction. None called. |

Primary references: [QueryTable.Refresh](https://learn.microsoft.com/office/vba/api/excel.querytable.refresh),
[Range.CopyPicture](https://learn.microsoft.com/en-us/office/vba/api/excel.range.copypicture),
[Range.ExportAsFixedFormat](https://learn.microsoft.com/en-us/office/vba/api/excel.range.exportasfixedformat),
[UnpivotOtherColumns](https://learn.microsoft.com/en-us/powerquery-m/table-unpivotothercolumns),
[Microsoft's Queries.Add/Mashup VBA example](https://support.microsoft.com/en-us/excel/import-and-shape-data-in-excel-for-mac-power-query).
These document the API choice, not the actual results.

No site UI, dependencies, post/draft/reproduction folders, git history, deployment,
accounts or external systems are changed. Site build/deployment checks are outside
this local lab's scope. This lab does not verify the exact ribbon click path,
other Excel versions/locales, automatic GUI type-detection, or human editorial
review. The published Using Locale post is read and hashed without modification.

See `REPORT.md`, `summary.json` and `repeatability.json` for actual run results.
See [GAPS.md](GAPS.md) for the completed encoding/image investigation, baseline
comparison, all 30 PNGs and the exact signing-test output.
