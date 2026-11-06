import assert from "node:assert/strict";
import test from "node:test";
import { topicIssue } from "../src/utils/postRules.ts";

test("published fixtures without a topic fail the schema rule", () => {
  assert.match(String(topicIssue({ draft: false })), /require a topic hub/);
  assert.match(String(topicIssue({})), /require a topic hub/);
});

test("draft fixtures without a topic pass so bundled examples still build", () => {
  assert.equal(topicIssue({ draft: true }), null);
});

test("only the three hub slugs are accepted", () => {
  assert.equal(topicIssue({ draft: false, topic: "excel-csv" }), null);
  assert.equal(
    topicIssue({ draft: false, topic: "google-sheets-apps-script" }),
    null
  );
  assert.equal(topicIssue({ draft: false, topic: "docs-web-work" }), null);
  assert.match(
    String(topicIssue({ draft: false, topic: "trend" })),
    /topic must be one of/
  );
});
