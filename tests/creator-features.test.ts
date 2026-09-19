import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getRelatedPosts } from "../src/utils/getRelatedPosts.ts";
import { resolveOperator } from "../src/config/operator.ts";

type FakePost = {
  id: string;
  collection: "posts";
  data: {
    author: string;
    title: string;
    description: string;
    tags: string[];
    pubDatetime: Date;
    modDatetime?: Date | null;
    draft?: boolean;
    aiAssisted: boolean;
    sources: string[];
    testingStatus: "not_tested" | "reproduced" | "official_source_only";
  };
};

const post = (
  id: string,
  tags: string[],
  date: string,
  draft = false
) =>
  ({
    id,
    collection: "posts",
    data: {
      author: "Test Author",
      title: id,
      description: id,
      tags,
      pubDatetime: new Date(date),
      draft,
      aiAssisted: false,
      sources: [],
      testingStatus: "not_tested",
    },
  }) as FakePost;

test("related posts rank shared tags, then update date, and exclude drafts/current", () => {
  const current = post("current", ["seo", "ai"], "2026-01-01");
  const oneTagNew = post("one-tag-new", ["seo"], "2026-05-01");
  const twoTagsOld = post("two-tags-old", ["seo", "ai"], "2025-01-01");
  const unrelated = post("unrelated", ["food"], "2026-06-01");
  const draft = post("draft", ["seo", "ai"], "2026-07-01", true);

  assert.deepEqual(
    getRelatedPosts([current, oneTagNew, twoTagsOld, unrelated, draft], current)
      .map(item => item.id),
    ["two-tags-old", "one-tag-new"]
  );
  assert.deepEqual(getRelatedPosts([current, unrelated], current), []);
});

test("public creator surfaces expose RSS and avoid fabricated engagement data", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const layout = readFileSync(`${root}/src/layouts/Layout.astro`, "utf8");
  const schema = readFileSync(`${root}/src/content.config.ts`, "utf8");
  const postPage = readFileSync(
    `${root}/src/pages/posts/[...slug]/index.astro`,
    "utf8"
  );
  const trustPanel = readFileSync(
    `${root}/src/components/PostTrustPanel.astro`,
    "utf8"
  );
  const rssRoute = readFileSync(`${root}/src/pages/rss.xml.ts`, "utf8");
  const newsItem = readFileSync(`${root}/src/components/NewsItem.astro`, "utf8");
  const template = readFileSync(`${root}/docs/xici-post-template.md`, "utf8");

  assert.match(layout, /application\/rss\+xml/);
  assert.match(layout, /getAssetPath\("rss\.xml"\)/);
  assert.match(rssRoute, /getSortedPosts\(posts\)/);
  assert.match(rssRoute, /getPostUrl\(/);
  assert.match(newsItem, /new URL\(config\.site\.url\)\.host/);
  assert.doesNotMatch(newsItem, /points|comments|HOT/);
  assert.match(newsItem, /prefers-reduced-motion/);
  for (const field of [
    "aiAssisted",
    "lastReviewed",
    "sources",
    "testingStatus",
    "correctionNote",
  ]) {
    assert.match(schema, new RegExp(field));
    assert.match(template, new RegExp(field));
  }
  assert.match(postPage, /PostTrustPanel/);
  assert.match(trustPanel, /data-trust-metadata/);
  assert.match(trustPanel, /sources/);
  assert.match(trustPanel, /testingStatus/);
  assert.match(trustPanel, /timeZone: config\.site\.timezone/);
  assert.doesNotMatch(trustPanel, /toISOString\(\)\.slice/);
});

test("commercial surfaces keep image and operator metadata deterministic", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const card = readFileSync(`${root}/src/components/Card.astro`, "utf8");
  const postLayout = readFileSync(`${root}/src/layouts/PostLayout.astro`, "utf8");
  const postPage = readFileSync(`${root}/src/pages/posts/[...slug]/index.astro`, "utf8");
  const readiness = readFileSync(`${root}/src/components/OperatorReadiness.astro`, "utf8");
  assert.doesNotMatch(card, /unsplash|loremflickr/i);
  assert.match(card, /role="img"/);
  assert.match(postLayout, /dateReviewed/);
  assert.match(postLayout, /citation/);
  assert.match(postLayout, /"Organization"/);
  assert.match(postLayout, /resolvedAuthor === site\.author/);
  assert.match(postPage, /author=\{post\.data\.author\}/);
  assert.match(readiness, /공개 이름 미제공/);
});

test("operator configuration uses safe empty defaults", () => {
  assert.deepEqual(resolveOperator({}), { creatorName: "", email: "", label: "", hasCreatorName: false, hasEmail: false });
  const configured = resolveOperator({ PUBLIC_CREATOR_NAME: "  Xici  ", PUBLIC_CONTACT_EMAIL: "owner@example.com", PUBLIC_CONTACT_LABEL: "문의하기" });
  assert.equal(configured.creatorName, "Xici");
  assert.equal(configured.hasCreatorName, true);
  assert.equal(configured.hasEmail, true);
  assert.equal(resolveOperator({ PUBLIC_CONTACT_EMAIL: "not-an-email" }).hasEmail, false);
});
