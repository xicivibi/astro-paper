import assert from "node:assert/strict";
import test from "node:test";
import { decodeCsvBytes, detectDelimiter, inspectCsv, parseCsv } from "../src/utils/csvPreview.ts";

test("parses quoted commas, escaped quotes, and multiline fields", () => {
  assert.deepEqual(parseCsv('name,note\n"Kim, A.","say ""hello""\nnext"', ","), [
    ["name", "note"],
    ["Kim, A.", 'say "hello"\nnext'],
  ]);
});

test("detects supported delimiters and keeps preview to twenty rows", () => {
  const csv = Array.from({ length: 25 }, (_, index) => `row-${index}\tvalue-${index}`).join("\n");
  assert.equal(detectDelimiter(csv), "\t");
  const result = inspectCsv(csv);
  assert.equal(result.rowCount, 25);
  assert.equal(result.firstRowColumnCount, 2);
  assert.equal(result.previewRows.length, 20);
});

test("reports BOM without claiming an otherwise unknown encoding", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("a,b\n1,2")]);
  const decoded = decodeCsvBytes(bytes);
  const result = inspectCsv(decoded.text, decoded.hasUtf8Bom);
  assert.equal(result.hasUtf8Bom, true);
  assert.match(result.warnings[0], /인코딩/);
});

test("prefers a delimiter used consistently across records", () => {
  const csv = [
    "name,description",
    "alpha,many;semicolons;appear;only;here",
    "beta,plain",
  ].join("\n");
  assert.equal(detectDelimiter(csv), ",");
});

test("counts one-column records and ignores empty physical lines", () => {
  const result = inspectCsv("alpha\n\nbeta\ngamma");
  assert.equal(result.delimiter, null);
  assert.equal(result.rowCount, 3);
  assert.deepEqual(result.previewRows, [["alpha"], ["beta"], ["gamma"]]);
});

test("warns when a quoted field is not closed", () => {
  const result = inspectCsv('name,note\nalpha,"unfinished');
  assert.match(result.warnings.join(" "), /닫히지 않은 큰따옴표/);
});
