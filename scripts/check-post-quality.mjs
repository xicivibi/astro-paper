/**
 * Post quality gate (enforced from the start; no warn-only phase).
 *
 * Posts published before GATE_START are grandfathered for the rules that the
 * 2026-09-20 guides could not meet when they were written (publishing pace,
 * human sign-off, second source, original asset). Those rules only warn for
 * them. Every other rule fails the build for every public post.
 *
 * This script only reads files. It never fills humanReviewedBy or any other
 * field: a human sign-off written by a tool would make the gate meaningless.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isPublicPost, readPosts } from "./lib/posts.mjs";

export const GATE_START = "2026-10-24T00:00:00+09:00";
export const OFFICIAL_SOURCE_HOSTS = Object.freeze([
  "learn.microsoft.com",
  "support.microsoft.com",
  "developers.google.com",
  "support.google.com",
]);
export const MIN_BODY_CHARS = 2500;
export const MIN_H2 = 3;
export const MIN_SOURCES = 2;
export const MAX_POSTS_PER_7_DAYS = 3;
export const MAX_OFFICIAL_ONLY_SHARE = 0.25;

const DAY_MS = 86_400_000;
const PUBLISHABLE_STATUSES = new Set(["reproduced", "official_source_only"]);
const BANNED_TITLE_PATTERNS = [
  /완벽\s*(?:가이드|대비|정리)/,
  /20\d\d년\s*(?:최신|완벽|필수)/,
  /현명한\s*선택/,
  /필수\s*(?:가이드|고려사항)/,
  /총정리/,
  /모든\s*것/,
];
const BANNED_TAGS = new Set([
  "trend",
  "trends",
  "google-trends",
  "google trends",
  "autopilot",
  "ai자동화",
  "ai 자동화",
  "트렌드",
  "실시간 검색어",
  "shopping",
  "쇼핑",
]);
/** Latin letters with diacritics (e.g. Vietnamese lottery keywords) or other scripts. */
const FOREIGN_TAG =
  /[À-ɏḀ-ỿ]|[^\p{Script=Hangul}\p{Script=Latin}\p{Number}\s.+#&/-]/u;
export const PLACEHOLDER_SIGNER =
  /^(?:todo|tbd|owner|소유자|미정|서명|이름|xxx+|none|n\/a|-)$/i;
export const MACHINE_SIGNER =
  /(?<![\p{L}\p{N}_])(?:chatgpt|gpt|codex|claude|클로드|opus|sonnet|haiku|fable|gemini|제미나이|grok|copilot|llama|bot|agent|ai)(?![\p{L}\p{N}_])/iu;

/** @param {unknown} value */
function toTime(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  return Date.parse(value);
}

/** @param {string} url */
function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** @param {string} host */
export function isOfficialHost(host) {
  return OFFICIAL_SOURCE_HOSTS.some(
    official => host === official || host.endsWith(`.${official}`)
  );
}

/**
 * Counts readable body characters including spaces (the common Korean
 * "공백 포함" convention) after removing Markdown syntax, link targets and
 * HTML tags, and collapsing whitespace runs.
 * @param {string} body
 */
export function readableLength(body) {
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^```.*$/gm, " ")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`|~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...text].length;
}

/** @param {string} body */
export function countH2(body) {
  const withoutCode = body.replace(/^```[\s\S]*?^```/gm, "");
  return (withoutCode.match(/^##\s+\S/gm) ?? []).length;
}

/**
 * @typedef {{ file: string, slug: string, data: Record<string, any>, body: string }} Post
 * @typedef {{ slug: string, rule: string, message: string }} Finding
 */

/**
 * @param {Post[]} allPosts
 * @param {{ gateStart?: string, now?: Date }} [options]
 */
export function evaluatePosts(allPosts, options = {}) {
  const gateStart = toTime(options.gateStart ?? GATE_START);
  const now = (options.now ?? new Date()).getTime();
  /** @type {Finding[]} */
  const errors = [];
  /** @type {Finding[]} */
  const warnings = [];
  const posts = allPosts.filter(post => isPublicPost(post.data));
  /** @param {Post} post */
  const isNew = post => !(toTime(post.data.pubDatetime) < gateStart);

  for (const post of posts) {
    const { data, body, slug } = post;
    const fresh = isNew(post);
    /** @param {string} rule @param {string} message @param {boolean} [grandfathered] */
    const report = (rule, message, grandfathered = false) =>
      (grandfathered && !fresh ? warnings : errors).push({
        slug,
        rule,
        message,
      });

    if (!Number.isFinite(toTime(data.pubDatetime))) {
      report("pubDatetime", "pubDatetime이 올바른 날짜가 아닙니다");
    }

    // (a) sources
    const sources = Array.isArray(data.sources) ? data.sources : [];
    if (sources.length < MIN_SOURCES) {
      report(
        "sources",
        `출처가 ${sources.length}개입니다. 최소 ${MIN_SOURCES}개가 필요합니다`,
        true
      );
    }
    if (!sources.some(url => isOfficialHost(hostOf(String(url))))) {
      report(
        "official-source",
        `공식 문서 출처(${OFFICIAL_SOURCE_HOSTS.join(", ")})가 1개 이상 필요합니다`
      );
    }

    // (b) original asset
    const kit = data.reproductionKit;
    const hasKit = Boolean(kit && typeof kit === "object" && kit.manifestPath);
    const hasToolLink =
      /\]\(\/tools\/[a-z0-9][a-z0-9/-]*\/\)/.test(body) ||
      Boolean(kit && typeof kit === "object" && kit.toolPath);
    if (!hasKit && !hasToolLink) {
      report(
        "original-asset",
        "재현 키트(reproductionKit.manifestPath) 또는 /tools/ 링크가 필요합니다",
        true
      );
    }

    // (c) testing status
    const status = data.testingStatus ?? "not_tested";
    if (!PUBLISHABLE_STATUSES.has(status)) {
      report(
        "testing-status",
        `testingStatus가 ${status}입니다. 공개 글은 reproduced 또는 official_source_only여야 합니다`
      );
    }
    if (status === "reproduced" && !hasKit) {
      report("reproduced-kit", "reproduced 글은 재현 키트가 필수입니다");
    }

    // (d) review date, length and structure
    if (!Number.isFinite(toTime(data.lastReviewed))) {
      report("last-reviewed", "lastReviewed가 필요합니다");
    }
    const length = readableLength(body);
    if (length < MIN_BODY_CHARS) {
      report(
        "body-length",
        `본문이 ${length}자입니다(공백 포함). 최소 ${MIN_BODY_CHARS}자가 필요합니다`
      );
    }
    const h2 = countH2(body);
    if (h2 < MIN_H2) {
      report("h2", `H2 소제목이 ${h2}개입니다. 최소 ${MIN_H2}개가 필요합니다`);
    }

    // (e) banned title phrases and tags
    const title = String(data.title ?? "");
    for (const pattern of BANNED_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        report("title", `제목에 금지 문구가 있습니다: ${pattern.source}`);
      }
    }
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    for (const tag of tags) {
      const normalized = tag.trim().toLocaleLowerCase("ko-KR");
      if (BANNED_TAGS.has(normalized) || FOREIGN_TAG.test(normalized)) {
        report("tag", `금지 태그입니다: ${tag}`);
      }
    }

    // (g) human sign-off
    const signer =
      typeof data.humanReviewedBy === "string"
        ? data.humanReviewedBy.trim()
        : "";
    const signedAt = toTime(data.humanReviewedAt);
    const missingSigner = !signer || PLACEHOLDER_SIGNER.test(signer);
    const missingDate = !Number.isFinite(signedAt);
    if (missingSigner || missingDate) {
      const missing = [
        missingSigner ? "humanReviewedBy(검토한 사람)" : "",
        missingDate ? "humanReviewedAt(검토 날짜)" : "",
      ]
        .filter(Boolean)
        .join("과 ");
      report(
        "human-sign-off",
        `${missing}이 비어 있습니다. 소유자가 글을 다시 읽고 직접 채워야 합니다`,
        true
      );
    }
    if (!missingSigner && MACHINE_SIGNER.test(signer)) {
      report(
        "human-sign-off",
        "humanReviewedBy에는 사람 이름만 쓸 수 있습니다(도구·AI 이름 불가)"
      );
    }
    if (!missingDate && signedAt > now) {
      report("human-sign-off", "humanReviewedAt이 미래 날짜입니다");
    }
  }

  // (f) publishing pace for posts published on or after the gate start.
  const freshPosts = posts
    .filter(isNew)
    .map(post => ({ post, time: toTime(post.data.pubDatetime) }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);
  const flagged = new Set();
  for (let start = 0; start < freshPosts.length; start += 1) {
    const windowEnd = freshPosts[start].time + 7 * DAY_MS;
    const inWindow = freshPosts.filter(
      item => item.time >= freshPosts[start].time && item.time < windowEnd
    );
    for (const item of inWindow.slice(MAX_POSTS_PER_7_DAYS)) {
      if (flagged.has(item.post.slug)) continue;
      flagged.add(item.post.slug);
      errors.push({
        slug: item.post.slug,
        rule: "pace",
        message: `7일 안에 공개 글이 ${inWindow.length}편입니다. 최대 ${MAX_POSTS_PER_7_DAYS}편입니다`,
      });
    }
  }

  // (c) share of official_source_only among new public posts.
  const officialOnly = freshPosts.filter(
    item => item.post.data.testingStatus === "official_source_only"
  );
  const allowedOfficialOnly =
    freshPosts.length >= 4
      ? Math.floor(freshPosts.length * MAX_OFFICIAL_ONLY_SHARE)
      : 1;
  if (officialOnly.length > allowedOfficialOnly) {
    for (const item of officialOnly.slice(allowedOfficialOnly)) {
      errors.push({
        slug: item.post.slug,
        rule: "official-only-share",
        message: `게이트 도입 후 official_source_only 글이 ${officialOnly.length}/${freshPosts.length}편입니다. 허용 ${allowedOfficialOnly}편`,
      });
    }
  }

  return {
    gateStart: new Date(gateStart).toISOString(),
    publicPosts: posts.length,
    newPosts: freshPosts.length,
    errors,
    warnings,
  };
}

/** @param {string} postsDirectory @param {{ gateStart?: string, now?: Date }} [options] */
export function checkPostDirectory(postsDirectory, options) {
  return evaluatePosts(readPosts(postsDirectory), options);
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = process.argv.slice(2);
  const directoryIndex = args.indexOf("--posts");
  const postsDirectory =
    directoryIndex >= 0
      ? resolve(args[directoryIndex + 1])
      : join(root, "src", "content", "posts");
  const result = checkPostDirectory(postsDirectory);
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    const lines = [
      `글 품질 게이트: 공개 글 ${result.publicPosts}편(도입 후 ${result.newPosts}편), 오류 ${result.errors.length}건, 경고 ${result.warnings.length}건`,
      ...result.errors.map(
        item => `  오류 [${item.rule}] ${item.slug}: ${item.message}`
      ),
      ...result.warnings.map(
        item => `  경고 [${item.rule}] ${item.slug}: ${item.message}`
      ),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
  }
  if (result.errors.length > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
