import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadReproductionKit,
  type ReproductionKitReference,
} from "../src/utils/reproductionKit.ts";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const expected = new Map([
  [
    "csv-korean-encoding-delimiter-checklist",
    "fd4547c45a482f90a5d0ade30dd2edc37b2bff0fb2021959ae8dfd46fe55aa04",
  ],
  [
    "excel-leading-zeros-large-identifiers-power-query",
    "c36e9e43e5e6764a485ddf57cf0f2cae33b2231a42ae5f1c6b90a33db3ab01df",
  ],
  [
    "power-query-folder-combine-header-column-order",
    "c468658162057f362af37975e3917d8c714e788db34f4139d7db381484a4f90f",
  ],
  [
    "power-query-left-anti-compare-lists",
    "534eb92c10fd974fe6dc2d4a3bf03e7e7fc69033511cc3ca6a3356ae827fc199",
  ],
  [
    "power-query-remove-duplicates-key-normalization",
    "26d3c1bebac3b3633e28e749d8004e5047ba4a8baae2192de8ba6a55060a6a62",
  ],
]);

test("published reproduced guides bind to valid content-addressed kits", () => {
  for (const [articleId, sha256] of expected) {
    const post = readFileSync(
      `${root}/src/content/posts/${articleId}.md`,
      "utf8"
    );
    const manifestPath = post.match(
      /manifestPath: "(\/reproduction\/[^"]+\/manifest\.json)"/
    )?.[1];
    assert.ok(manifestPath, `${articleId} is missing manifestPath`);
    assert.match(post, new RegExp(`sha256: "${sha256}"`));
    const reference: ReproductionKitReference = { manifestPath, sha256 };
    const manifest = loadReproductionKit(reference, articleId, root);
    assert.equal(manifest.evidence.result, "pass");
    assert.ok(manifest.procedure.length >= 3);
    assert.ok(manifest.resources.some(resource => resource.role === "input"));
    assert.ok(
      manifest.resources.some(resource => resource.role === "expected")
    );
    assert.ok(manifest.limitations.length >= 1);
  }
});

test("official-source-only guide does not claim a reproduction kit", () => {
  const post = readFileSync(
    `${root}/src/content/posts/power-query-csv-date-using-locale.md`,
    "utf8"
  );
  assert.match(post, /testingStatus: official_source_only/);
  assert.doesNotMatch(post, /reproductionKit:/);
});

test("reproduction kit UI remains static and account-free", () => {
  const component = readFileSync(
    `${root}/src/components/ReproductionKit.astro`,
    "utf8"
  );
  const loader = readFileSync(
    `${root}/src/utils/reproductionKit.ts`,
    "utf8"
  );
  assert.match(component, /data-reproduction-kit/);
  assert.match(component, /download/);
  assert.doesNotMatch(component + loader, /\bfetch\s*\(/);
  assert.doesNotMatch(component + loader, /XMLHttpRequest|FormData|apiKey/);
});

