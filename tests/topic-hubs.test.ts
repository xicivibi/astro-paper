import assert from "node:assert/strict";
import test from "node:test";
import { topics } from "../src/config/topics.ts";
import { getTopicPosts, postMatchesTopic } from "../src/utils/topicPosts.ts";

const fakePost = (id: string, tags: string[], draft = false) =>
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
