import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import test from "node:test";
import { expiredTrendPaths } from "../src/utils/expiredTrendPaths.ts";

test("expired trend stays routable but is removed from sitemap inputs", () => {
  const root = mkdtempSync(resolve(tmpdir(), "xici-trend-paths-"));
  try {
    const filename = `xici-trend-${"a".repeat(20)}.md`;
    writeFileSync(
      resolve(root, filename),
      `---\ntrendBundle: ${JSON.stringify({ schemaVersion: "trend-bundle-v1", freshUntil: "2026-09-27T12:00:00Z" })}\n---\n`
    );
    const manualFilename = "manual-shopping-trend.md";
    writeFileSync(
      resolve(root, manualFilename),
      `---\ntrendLifecycle:\n  freshUntil: 2026-09-27T12:00:00Z\n---\n`
    );
    const route = `/posts/${filename.slice(0, -3)}/`;
    assert.deepEqual(
      [...expiredTrendPaths(root, new Date("2026-09-27T11:59:59Z"))],
      []
    );
    assert.deepEqual(
      [...expiredTrendPaths(root, new Date("2026-09-27T12:00:00Z"))].sort(),
      ["/posts/manual-shopping-trend/", route]
    );
  } finally {
    assert.equal(basename(root).startsWith("xici-trend-paths-"), true);
    assert.equal(resolve(root).startsWith(resolve(tmpdir())), true);
    rmSync(root, { recursive: true, force: true });
  }
});
