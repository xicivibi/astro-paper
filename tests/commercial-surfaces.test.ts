import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectIdentifiers } from "../src/utils/identifierInspector.ts";
import { compareLists } from "../src/utils/listComparator.ts";
import { compareHeaders } from "../src/utils/headerComparator.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8");

test("identifier inspector preserves source text and flags spreadsheet risks", () => {
  const rows = inspectIdentifiers("00123\n12345678901234567\nABC-007\n");

  assert.deepEqual(
    rows.map(row => row.value),
    ["00123", "12345678901234567", "ABC-007"]
  );
  assert.equal(rows[0].leadingZeroRisk, true);
  assert.equal(rows[1].precisionRisk, true);
  assert.equal(rows[2].leadingZeroRisk, false);
});

test("list comparator normalizes without hiding original left-only values", () => {
  const result = compareLists(" A-01 \nB-02\nB-02\nC-03", "a-01\nD-04", {
    trim: true,
    caseSensitive: false,
  });

  assert.deepEqual(result.leftOnly, ["B-02", "C-03"]);
  assert.deepEqual(result.rightOnly, ["D-04"]);
  assert.deepEqual(result.common, ["A-01"]);
  assert.deepEqual(result.duplicateLeft, ["B-02"]);
});

test("header comparator separates missing columns from order drift", () => {
  const result = compareHeaders(
    "customer_id\norder_date\namount",
    "amount\ncustomer_id\ncurrency"
  );

  assert.deepEqual(result.onlyLeft, ["order_date"]);
  assert.deepEqual(result.onlyRight, ["currency"]);
  assert.equal(result.sameSet, false);
  assert.equal(result.sameOrder, false);
});

test("public retention and utility surfaces are linked and downloadable", () => {
  const header = read("src/components/Header.astro");
  const footer = read("src/components/Footer.astro");
  const home = read("src/pages/index.astro");
  const tools = read("src/pages/tools/index.astro");
  const briefIndex = read("src/pages/briefs/index.astro");
  const brief = read("src/pages/briefs/2026-09-20.astro");
  const topic = read("src/pages/topics/[slug].astro");

  assert.match(header, /href: getRelativeLocaleUrl\(locale, "briefs"\)/);
  assert.match(footer, /href="\/rss\.xml"/);
  assert.match(home, /href="\/rss\.xml"/);
  assert.match(briefIndex, /2026-09-20/);
  assert.match(brief, /getSortedPosts/);
  assert.match(brief, /검증 글 6편/);
  for (const slug of [
    "identifier-check",
    "list-compare",
    "header-compare",
  ]) {
    assert.match(tools, new RegExp(`/tools/${slug}/`));
    assert.equal(existsSync(`${root}/src/pages/tools/${slug}.astro`), true);
  }
  assert.match(topic, /excelCsvJourney/);
  assert.match(topic, /문제 해결 순서/);
  for (const sample of [
    "identifier-sample.csv",
    "list-a.txt",
    "list-b.txt",
    "headers-a.txt",
    "headers-b.txt",
  ]) {
    assert.equal(existsSync(`${root}/public/samples/${sample}`), true);
  }
});

test("verified articles link back to their matching browser tools", () => {
  const links = new Map([
    ["csv-korean-encoding-delimiter-checklist.md", "/tools/csv-preview/"],
    [
      "excel-leading-zeros-large-identifiers-power-query.md",
      "/tools/identifier-check/",
    ],
    [
      "power-query-folder-combine-header-column-order.md",
      "/tools/header-compare/",
    ],
    ["power-query-left-anti-compare-lists.md", "/tools/list-compare/"],
  ]);
  for (const [article, href] of links) {
    assert.match(
      read(`src/content/posts/${article}`),
      new RegExp(href.replaceAll("/", "\\/"))
    );
  }
});

test("article structured data includes grounded site relationships", () => {
  const layout = read("src/layouts/PostLayout.astro");
  assert.match(layout, /publisher:/);
  assert.match(layout, /inLanguage: site\.lang/);
  assert.match(layout, /isPartOf:/);
});
