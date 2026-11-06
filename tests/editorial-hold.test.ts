import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  isLegacyHoldPostId,
  isLegacyHoldPostPath,
  legacyHoldPostIds,
} from "../src/config/editorial.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const postsDirectory = join(root, "src", "content", "posts");

test("deleted autopilot posts stay deleted and the hold list is empty", () => {
  const generated = readdirSync(postsDirectory).filter(name =>
    /^post-\d{8}-\d{6}-[0-9a-f]+\.mdx?$/.test(name)
  );
  assert.deepEqual(generated, []);
  assert.deepEqual([...legacyHoldPostIds], []);
});

test("editorial hold matching works on fixture ids", () => {
  const fixtureIds = ["post-20990101-000000-abcdef0123"];
  assert.equal(isLegacyHoldPostId(`${fixtureIds[0]}.md`, fixtureIds), true);
  assert.equal(isLegacyHoldPostId("other-post", fixtureIds), false);
  assert.equal(
    isLegacyHoldPostPath(`/posts/${fixtureIds[0]}/`, fixtureIds),
    true
  );
  assert.equal(isLegacyHoldPostPath("/posts/other/", fixtureIds), false);
  assert.equal(isLegacyHoldPostPath(`/posts/${fixtureIds[0]}/`), false);
});

test("editorial hold is still enforced across discovery surfaces", () => {
  const schema = readFileSync(join(root, "src", "content.config.ts"), "utf8");
  const filter = readFileSync(
    join(root, "src", "utils", "postFilter.ts"),
    "utf8"
  );
  const route = readFileSync(
    join(root, "src", "pages", "posts", "[...slug]", "index.astro"),
    "utf8"
  );
  const sitemap = readFileSync(join(root, "astro.config.ts"), "utf8");

  assert.match(schema, /editorialStatus/);
  assert.match(schema, /legacy_hold/);
  assert.match(filter, /data\.editorialStatus !== "legacy_hold"/);
  assert.match(route, /noindex=\{isHeld \|\| isExpiredTrend\}/);
  assert.match(
    route,
    /data-pagefind-ignore=\{isHeld \|\| isExpiredTrend \? "all"/
  );
  assert.match(route, /PostReviewHoldNotice/);
  assert.match(sitemap, /isLegacyHoldPostPath/);
});
