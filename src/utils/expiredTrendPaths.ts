import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const trendFilename = /^xici-trend-[0-9a-f]{20}\.md$/;
const bundleLine = /^trendBundle: (\{[^\r\n]*\})$/m;
const lifecycleBlock = /^trendLifecycle:\r?\n((?:  [^\r\n]+\r?\n)+)/m;

/** Keep an expired trend URL routable with noindex, but out of the sitemap. */
export function expiredTrendPaths(postsDir: string, now: Date): Set<string> {
  const paths = new Set<string>();
  for (const filename of readdirSync(postsDir)) {
    if (!filename.endsWith(".md")) continue;
    const source = readFileSync(join(postsDir, filename), "utf8");
    const bundleMatch = bundleLine.exec(source);
    const manualMatch = lifecycleBlock.exec(source);
    if (trendFilename.test(filename) && !bundleMatch)
      throw new Error(`Trend lifecycle metadata missing: ${filename}`);
    if (!bundleMatch && !manualMatch) continue;
    if (bundleMatch && manualMatch)
      throw new Error(`Trend lifecycle metadata duplicated: ${filename}`);
    const lifecycle = bundleMatch
      ? (JSON.parse(bundleMatch[1]) as Record<string, unknown>)
      : null;
    const freshUntil = bundleMatch
      ? lifecycle?.freshUntil
      : /^  freshUntil: (\S+)$/m.exec(manualMatch![1])?.[1];
    if (
      (bundleMatch && lifecycle?.schemaVersion !== "trend-bundle-v1") ||
      typeof freshUntil !== "string" ||
      !Number.isFinite(Date.parse(freshUntil))
    ) {
      throw new Error(`Trend lifecycle metadata invalid: ${filename}`);
    }
    if (Date.parse(freshUntil) <= now.getTime()) {
      paths.add(`/posts/${filename.slice(0, -3)}/`);
    }
  }
  return paths;
}
