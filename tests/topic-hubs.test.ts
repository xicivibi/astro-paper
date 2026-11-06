import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  backlogClusterTopics,
  topicSlugs,
  topics,
} from "../src/config/topics.ts";
import { isPublicPost, readPosts } from "../scripts/lib/posts.mjs";
import * as topicPosts from "../src/utils/topicPosts.ts";

const { getTopicPosts, postMatchesTopic } = topicPosts;

const fakePost = (
  id: string,
  tags: string[],
  draft = false,
  editorialStatus: "published" | "legacy_hold" = "published"
) =>
  ({
    id,
    collection: "posts",
    data: {
      author: "Test Author",
      title: id,
      description: id,
      tags,
      pubDatetime: new Date("2026-01-01"),
      draft,
      editorialStatus,
      aiAssisted: false,
      sources: [],
      testingStatus: "not_tested",
    },
  }) as never;

test("topic hubs use explicit, case-insensitive tags only", () => {
  const topic = topics.find(item => item.slug === "excel-csv")!;
  assert.equal(postMatchesTopic(fakePost("excel", [" Excel "]), topic), true);
  assert.equal(
    postMatchesTopic(fakePost("spreadsheet", ["스프레드시트"]), topic),
    false
  );
  assert.deepEqual(
    getTopicPosts(
      [fakePost("a", ["csv"]), fakePost("draft", ["csv"], true)],
      topic
    ).map(post => post.id),
    ["a"]
  );
});

test("the three hub definitions have honest empty-state copy", () => {
  assert.deepEqual(
    topics.map(topic => topic.slug),
    ["excel-csv", "google-sheets-apps-script", "docs-web-work"]
  );
  for (const topic of topics) {
    assert.ok(topic.intro.length > 0);
    assert.match(topic.emptyState, /아직/);
  }
});

test("topic discovery exposes only hubs with public posts and their counts", () => {
  assert.equal(
    typeof (topicPosts as Record<string, unknown>).getActiveTopicSummaries,
    "function"
  );

  const posts = [
    fakePost("csv-a", ["csv"]),
    fakePost("csv-b", ["EXCEL"]),
    fakePost("held", ["csv"], false, "legacy_hold"),
    fakePost("unmapped", ["seo"]),
  ];

  const summaries = (
    topicPosts as {
      getActiveTopicSummaries: (
        posts: never[],
        topics: typeof import("../src/config/topics.ts").topics
      ) => { topic: { slug: string }; count: number }[];
    }
  ).getActiveTopicSummaries(posts as never[], topics);

  assert.deepEqual(
    summaries.map(({ topic, count }) => [topic.slug, count]),
    [["excel-csv", 2]]
  );
});

test("an explicit topic field is authoritative over tags", () => {
  const sheets = topics.find(item => item.slug === "google-sheets-apps-script")!;
  const excel = topics.find(item => item.slug === "excel-csv")!;
  const post = fakePost("apps-script-csv", ["csv"]) as {
    data: { topic?: string };
  };
  post.data.topic = "google-sheets-apps-script";
  assert.equal(postMatchesTopic(post as never, sheets), true);
  assert.equal(postMatchesTopic(post as never, excel), false);
});

test("backlog clusters map onto the three hubs", () => {
  assert.deepEqual(Object.keys(backlogClusterTopics).sort(), [
    "Excel CSV",
    "Power Query",
    "Sheets Forms",
    "업무 자동화 선택",
  ]);
  for (const slug of Object.values(backlogClusterTopics)) {
    assert.ok(topicSlugs.includes(slug));
  }
});

test("every public post names one hub and carries normalized tags", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const posts = readPosts(join(root, "src", "content", "posts")).filter(post =>
    isPublicPost(post.data)
  );
  assert.ok(posts.length > 0);
  const postsPerHub = new Map<string, number>();
  for (const post of posts) {
    const topic = topics.find(item => item.slug === post.data.topic);
    assert.ok(topic, `${post.slug} must name a hub`);
    postsPerHub.set(topic.slug, (postsPerHub.get(topic.slug) ?? 0) + 1);
    const tags: string[] = post.data.tags;
    for (const tag of tags) {
      assert.equal(tag, tag.trim().toLocaleLowerCase("ko-KR"), post.slug);
    }
    assert.equal(new Set(tags).size, tags.length, `${post.slug} repeats a tag`);
    assert.ok(
      tags.some(tag => topic.tags.includes(tag)),
      `${post.slug} needs at least one ${topic.slug} hub tag`
    );
  }
  // Each hub that is linked from the home page has at least one post.
  for (const [slug, count] of postsPerHub) {
    assert.ok(count >= 1, slug);
  }
});
