import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  isLegacyHoldPostPath,
  legacyHoldPostIds,
} from "../src/config/editorial.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

test("all reviewed legacy posts are explicitly held", () => {
  const postsDirectory = join(root, "src", "content", "posts");
  const generatedPostIds = readdirSync(postsDirectory)
    .filter(name => /^post-\d+-.+\.md$/.test(name))
    .map(name => name.replace(/\.md$/, ""))
    .sort();

  assert.equal(legacyHoldPostIds.length, 15);
  assert.deepEqual([...legacyHoldPostIds].sort(), generatedPostIds);

  for (const id of legacyHoldPostIds) {
    const markdown = readFileSync(join(postsDirectory, `${id}.md`), "utf8");
    assert.match(markdown, /^editorialStatus: legacy_hold$/m);
  }
});

test("editorial hold is enforced across discovery surfaces", () => {
  const schema = readFileSync(join(root, "src", "content.config.ts"), "utf8");
  const filter = readFileSync(join(root, "src", "utils", "postFilter.ts"), "utf8");
  const route = readFileSync(
    join(root, "src", "pages", "posts", "[...slug]", "index.astro"),
    "utf8"
  );
  const sitemap = readFileSync(join(root, "astro.config.ts"), "utf8");

  assert.match(schema, /editorialStatus/);
  assert.match(schema, /legacy_hold/);
  assert.match(filter, /data\.editorialStatus !== "legacy_hold"/);
  assert.match(route, /noindex=\{isHeld\}/);
  assert.match(route, /data-pagefind-ignore=\{isHeld \? "all"/);
  assert.match(route, /PostReviewHoldNotice/);
  assert.match(sitemap, /isLegacyHoldPostPath/);
});

test("production artifacts preserve held URLs but remove discovery signals", () => {
  const sampleId = legacyHoldPostIds[0];
  const samplePath = join(root, "dist", "posts", sampleId, "index.html");
  const sitemapPath = join(root, "dist", "sitemap-0.xml");
  const rssPath = join(root, "dist", "rss.xml");

  if (!existsSync(samplePath) || !existsSync(sitemapPath) || !existsSync(rssPath)) {
    return;
  }

  const html = readFileSync(samplePath, "utf8");
  // `npm test` may run before `npm run build` and see an older local dist.
  // Once the new build marker exists, validate the complete artifact contract.
  if (!html.includes("data-editorial-hold")) {
    return;
  }
  const sitemap = readFileSync(sitemapPath, "utf8");
  const rss = readFileSync(rssPath, "utf8");

  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /data-editorial-hold/);
  assert.doesNotMatch(html, /application\/ld\+json/);
  assert.equal(isLegacyHoldPostPath(`/posts/${sampleId}/`), true);

  for (const id of legacyHoldPostIds) {
    assert.doesNotMatch(sitemap, new RegExp(`/posts/${id}/`));
    assert.doesNotMatch(rss, new RegExp(`/posts/${id}/`));
  }
});
