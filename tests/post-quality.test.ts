import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "./helpers/test-api.ts";
import {
  checkPostDirectory,
  evaluatePosts,
  GATE_START,
  readableLength,
} from "../scripts/check-post-quality.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const now = new Date("2026-12-31T00:00:00+09:00");

const paragraph =
  "CSV 파일을 가져올 때는 원본을 복사하고 구분자와 인코딩을 차례로 확인합니다. 결과 표의 행 수와 열 이름을 원본과 비교해 차이를 기록합니다. ";
const longBody = [
  "## 원본을 먼저 보존합니다",
  paragraph.repeat(12),
  "## 가져오기 설정을 확인합니다",
  paragraph.repeat(12),
  "## 결과를 원본과 비교합니다",
  paragraph.repeat(12),
  "[CSV 파일 점검 도구](/tools/csv-preview/)",
].join("\n\n");

type Data = Record<string, unknown>;

function fixture(slug: string, overrides: Data = {}, body = longBody) {
  return {
    file: `${slug}.md`,
    slug,
    body,
    data: {
      title: "CSV 날짜 열을 텍스트로 가져오는 순서",
      pubDatetime: "2026-11-02T09:00:00+09:00",
      draft: false,
      topic: "excel-csv",
      tags: ["excel", "csv"],
      sources: [
        "https://support.microsoft.com/en-us/excel/import-data",
        "https://www.rfc-editor.org/info/rfc4180/",
      ],
      testingStatus: "reproduced",
      reproductionKit: {
        manifestPath: `/reproduction/${slug}/${"a".repeat(64)}/manifest.json`,
        sha256: "a".repeat(64),
      },
      lastReviewed: "2026-11-02T09:00:00+09:00",
      humanReviewedBy: "홍길동",
      humanReviewedAt: "2026-11-02T10:00:00+09:00",
      ...overrides,
    },
  };
}

function rulesFor(posts: ReturnType<typeof fixture>[]) {
  const result = evaluatePosts(posts, { now });
  return {
    errors: result.errors.map(item => `${item.slug}:${item.rule}`),
    warnings: result.warnings.map(item => `${item.slug}:${item.rule}`),
  };
}

test("a complete post published after the gate passes", () => {
  assert.ok(readableLength(longBody) >= 2500);
  assert.deepEqual(rulesFor([fixture("good")]), { errors: [], warnings: [] });
});

test("each failing fixture is rejected by its own rule", () => {
  const cases: [string, Data, string?][] = [
    ["one-source", { sources: ["https://support.microsoft.com/a"] }],
    [
      "no-official",
      { sources: ["https://example.com/a", "https://example.org/b"] },
    ],
    ["title", { title: "2026년 최신 엑셀 CSV 완벽 가이드" }],
    ["tag", { tags: ["excel", "trend"] }],
    ["foreign-tag", { tags: ["excel", "xổ số"] }],
    ["unsigned", { humanReviewedBy: "" }],
    ["undated", { humanReviewedAt: null }],
    ["machine-signer", { humanReviewedBy: "Claude" }],
    ["reproduced-no-kit", { reproductionKit: undefined }],
    ["not-tested", { testingStatus: "not_tested" }],
    ["no-review-date", { lastReviewed: null }],
  ];
  const expected: Record<string, string> = {
    "one-source": "sources",
    "no-official": "official-source",
    title: "title",
    tag: "tag",
    "foreign-tag": "tag",
    unsigned: "human-sign-off",
    undated: "human-sign-off",
    "machine-signer": "human-sign-off",
    "reproduced-no-kit": "reproduced-kit",
    "not-tested": "testing-status",
    "no-review-date": "last-reviewed",
  };
  for (const [slug, overrides] of cases) {
    const { errors } = rulesFor([fixture(slug, overrides)]);
    assert.ok(
      errors.includes(`${slug}:${expected[slug]}`),
      `${slug} → ${errors.join(", ")}`
    );
  }
});

test("short or flat bodies fail length and structure rules", () => {
  const short = rulesFor([
    fixture("short", {}, "## 하나\n\n짧은 글\n\n## 둘\n\n## 셋"),
  ]);
  assert.ok(short.errors.includes("short:body-length"));
  const flat = rulesFor([
    fixture("flat", {}, longBody.replaceAll("## ", "")),
  ]);
  assert.ok(flat.errors.includes("flat:h2"));
});

test("a fourth post inside seven days after the gate is rejected", () => {
  const days = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
  const posts = days.map((day, index) =>
    fixture(`pace-${index}`, { pubDatetime: `${day}T09:00:00+09:00` })
  );
  assert.deepEqual(rulesFor(posts).errors, ["pace-3:pace"]);
  const spaced = posts.map((post, index) =>
    fixture(post.slug, {
      pubDatetime: `2026-11-${String(2 + index * 3).padStart(2, "0")}T09:00:00+09:00`,
    })
  );
  assert.deepEqual(rulesFor(spaced).errors, []);
});

test("official_source_only stays a minority of new posts", () => {
  const posts = [0, 1, 2, 3].map(index =>
    fixture(`share-${index}`, {
      pubDatetime: `2026-11-${String(2 + index * 3).padStart(2, "0")}T09:00:00+09:00`,
      testingStatus: index < 2 ? "official_source_only" : "reproduced",
    })
  );
  assert.deepEqual(rulesFor(posts).errors, ["share-1:official-only-share"]);
});

test("posts before the gate only warn for grandfathered rules", () => {
  const legacy = fixture("legacy", {
    pubDatetime: "2026-09-20T03:05:00+09:00",
    sources: ["https://support.microsoft.com/only-one"],
    humanReviewedBy: "",
    humanReviewedAt: null,
  });
  assert.deepEqual(rulesFor([legacy]), {
    errors: [],
    warnings: ["legacy:sources", "legacy:human-sign-off"],
  });
  // Rules that every post can meet still fail for old posts.
  const badLegacy = fixture("bad-legacy", {
    pubDatetime: "2026-09-20T03:05:00+09:00",
    title: "현명한 선택을 위한 CSV 정리",
  });
  assert.ok(rulesFor([badLegacy]).errors.includes("bad-legacy:title"));
  assert.ok(Date.parse(GATE_START) > Date.parse("2026-09-20T03:05:00+09:00"));
});

test("drafts are outside the public gate until the owner publishes them", () => {
  const draft = fixture("draft", {
    draft: true,
    testingStatus: "not_tested",
    humanReviewedBy: undefined,
    humanReviewedAt: undefined,
  });
  assert.deepEqual(rulesFor([draft]), { errors: [], warnings: [] });
  const published = fixture("draft", {
    draft: false,
    testingStatus: "not_tested",
    humanReviewedBy: undefined,
    humanReviewedAt: undefined,
  });
  const { errors } = rulesFor([published]);
  assert.ok(errors.includes("draft:testing-status"));
  assert.ok(errors.includes("draft:human-sign-off"));
});

test("the current public posts pass with sign-off warnings only", () => {
  const result = checkPostDirectory(join(root, "src", "content", "posts"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.publicPosts, 6);
  const signOff = result.warnings.filter(
    item => item.rule === "human-sign-off"
  );
  assert.equal(signOff.length, 6);
  // The folder-combine source gap has been resolved; the locale asset remains.
  assert.deepEqual(
    result.warnings
      .filter(item => item.rule !== "human-sign-off")
      .map(item => `${item.slug}:${item.rule}`)
      .sort(),
    [
      "power-query-csv-date-using-locale:original-asset",
    ]
  );
});

test("no code path fills the human sign-off fields", () => {
  const gate = readFileSync(
    join(root, "scripts", "check-post-quality.mjs"),
    "utf8"
  );
  const schema = readFileSync(join(root, "src", "content.config.ts"), "utf8");
  assert.doesNotMatch(gate, /writeFile|appendFile/);
  assert.doesNotMatch(gate, /humanReviewedBy\s*[:=]\s*["'`]/);
  const schemaLines = schema
    .split("\n")
    .filter(line => /humanReviewed(By|At)/.test(line));
  assert.equal(schemaLines.length, 2);
  for (const line of schemaLines) assert.doesNotMatch(line, /\.default\(/);
  for (const file of [
    "csv-korean-encoding-delimiter-checklist",
    "power-query-left-anti-compare-lists",
  ]) {
    const source = readFileSync(
      join(root, "src", "content", "posts", `${file}.md`),
      "utf8"
    );
    assert.match(source, /^humanReviewedBy: ""$/m);
  }
});

test("a draft-howto pack stays out of the gate until the owner publishes it", async () => {
  const { parsePostSource } = await import("../scripts/lib/posts.mjs");
  const source = readFileSync(
    join(root, "tests", "fixtures", "draft-pack-sample.md"),
    "utf8"
  );
  const { data, body } = parsePostSource(source);
  assert.equal(data.draft, true);
  assert.equal(data.testingStatus, "not_tested");
  assert.equal("humanReviewedBy" in data, false);
  const draftResult = evaluatePosts(
    [{ file: "sample.md", slug: "sample", data, body }],
    { now }
  );
  assert.equal(draftResult.publicPosts, 0);
  assert.deepEqual(draftResult.errors, []);

  const flipped = evaluatePosts(
    [{ file: "sample.md", slug: "sample", data: { ...data, draft: false }, body }],
    { now }
  );
  const rules = new Set(flipped.errors.map(item => item.rule));
  assert.ok(rules.has("testing-status"));
  assert.ok(rules.has("human-sign-off"));
});
