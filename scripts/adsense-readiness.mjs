/**
 * AdSense readiness check. Reads the built `dist` folder and environment
 * variables only; it calls no model and no network service.
 *
 * The check is enforced (non-zero exit) only for verify/serve builds. An
 * ordinary off-mode deployment is never blocked by it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPostDirectory } from "./check-post-quality.mjs";
import { servesAds } from "./serve-headers.mjs";

export const MIN_PUBLIC_POSTS = 20;
export const SHARED_HOST_SUFFIXES = Object.freeze([
  ".vercel.app",
  ".pages.dev",
  ".github.io",
  ".netlify.app",
]);
const TRUST_PAGES = ["about", "privacy", "contact", "editorial-policy"];
const EMAIL =
  /^[A-Za-z0-9.!$&'*+/=`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const SAMPLE_EMAIL =
  /@(?:example\.(?:com|org|net)|test\.invalid)$|^(?:you|your|name|email|owner)@/i;
const ADS_LINE = /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0\n$/;

/** @param {string} path */
function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/** @param {string} email */
function maskEmail(email) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * @param {{
 *   distDir: string,
 *   mode?: string,
 *   origin?: string,
 *   env?: Record<string, string | undefined>,
 *   gate?: { errors: unknown[], warnings: unknown[] },
 * }} input
 */
export function evaluateReadiness(input) {
  const env = input.env ?? {};
  const dist = resolve(input.distDir);
  const home = readText(join(dist, "index.html")) ?? "";
  // The built HTML reveals the mode even when variables came from a .env file.
  const builtMode = servesAds(dist)
    ? "serve"
    : /<meta name="google-adsense-account"/.test(home)
      ? "verify"
      : "off";
  const mode = String(input.mode || env.PUBLIC_ADSENSE_MODE || builtMode);
  if (!["off", "verify", "serve"].includes(mode)) {
    throw new Error("mode must be off, verify, or serve");
  }
  const canonical =
    /<link rel="canonical" href="([^"]+)"/.exec(home)?.[1] ?? "";
  const originValue = input.origin || env.PUBLIC_SITE_URL || canonical;
  /** @type {URL | null} */
  let origin = null;
  try {
    origin = originValue ? new URL(originValue) : null;
  } catch {
    origin = null;
  }
  const originText = origin ? origin.origin : "";

  /** @type {{ id: string, label: string, pass: boolean, evidence: Record<string, unknown> }[]} */
  const checks = [];
  /** @param {string} id @param {string} label @param {boolean} pass @param {Record<string, unknown>} evidence */
  const add = (id, label, pass, evidence) =>
    checks.push({ id, label, pass, evidence });

  const sitemap = readText(join(dist, "sitemap-0.xml")) ?? "";
  const postUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(match => {
      try {
        return new URL(match[1]).pathname;
      } catch {
        return "";
      }
    })
    .filter(path => /^\/posts\/[^/]+\/$/.test(path))
    .filter(path => !/^\/posts\/(?:\d+|list)\/$/.test(path));
  add(
    "public-posts",
    `공개 글 ${MIN_PUBLIC_POSTS}편 이상`,
    postUrls.length >= MIN_PUBLIC_POSTS,
    { count: postUrls.length, required: MIN_PUBLIC_POSTS }
  );

  const presentTrust = TRUST_PAGES.filter(page =>
    existsSync(join(dist, page, "index.html"))
  );
  add("trust-pages", "신뢰 페이지 4개", presentTrust.length === 4, {
    present: presentTrust,
    missing: TRUST_PAGES.filter(page => !presentTrust.includes(page)),
  });

  const email = String(
    env.PUBLIC_OPERATOR_EMAIL ?? env.PUBLIC_CONTACT_EMAIL ?? ""
  ).trim();
  const emailOk = EMAIL.test(email) && !SAMPLE_EMAIL.test(email);
  add("operator-email", "운영자 공개 이메일", emailOk, {
    configured: email ? maskEmail(email) : "",
  });

  const about = readText(join(dist, "about", "index.html")) ?? "";
  add(
    "owner-experience",
    "소개 페이지의 운영자 경험 문단(소유자 작성)",
    about.includes('data-operator-experience="written"'),
    {
      state: about.includes('data-operator-experience="written"')
        ? "written"
        : about.includes('data-operator-experience="pending"')
          ? "placeholder"
          : "missing",
    }
  );

  const host = origin?.hostname.toLowerCase() ?? "";
  const sharedSuffix = SHARED_HOST_SUFFIXES.find(suffix =>
    host.endsWith(suffix)
  );
  add(
    "own-domain",
    "소유 도메인(공유 서브도메인 아님, HTTPS)",
    Boolean(origin) &&
      origin?.protocol === "https:" &&
      !sharedSuffix &&
      host !== "localhost",
    { origin: originText, sharedSuffix: sharedSuffix ?? "" }
  );

  const sitemapIndex = readText(join(dist, "sitemap-index.xml")) ?? "";
  add(
    "sitemap",
    "사이트맵이 같은 origin을 가리킴",
    Boolean(originText) && sitemapIndex.includes(`${originText}/sitemap-0.xml`),
    { file: sitemapIndex ? "sitemap-index.xml" : "", origin: originText }
  );

  const robots = readText(join(dist, "robots.txt")) ?? "";
  add(
    "robots",
    "robots.txt 사이트맵 선언",
    Boolean(originText) &&
      robots.includes(`Sitemap: ${originText}/sitemap-index.xml`),
    { present: Boolean(robots) }
  );

  const ads = readText(join(dist, "ads.txt"));
  const adsOk =
    ads !== null && (mode === "off" ? true : ADS_LINE.test(ads));
  add("ads-txt", "ads.txt", adsOk, {
    present: ads !== null,
    lines: ads === null ? 0 : ads.split("\n").filter(Boolean).length,
    publisherLine: ads !== null && ADS_LINE.test(ads),
  });

  const gate = input.gate ?? { errors: [], warnings: [] };
  add(
    "quality-gate",
    "글 품질 게이트 오류·경고 0건",
    gate.errors.length === 0 && gate.warnings.length === 0,
    { errors: gate.errors.length, warnings: gate.warnings.length }
  );

  const ready = checks.every(check => check.pass);
  const enforced = mode !== "off";
  return { mode, origin: originText, ready, enforced, ok: ready || !enforced, checks };
}

/** @param {ReturnType<typeof evaluateReadiness>} result */
export function formatReadiness(result) {
  const lines = [
    `AdSense 준비도 (모드: ${result.mode}, origin: ${result.origin || "알 수 없음"})`,
    ...result.checks.map(
      check =>
        `  ${check.pass ? "통과" : "미달"}  ${check.label}  ${JSON.stringify(check.evidence)}`
    ),
    result.ready
      ? "결과: 모든 항목 통과"
      : result.enforced
        ? "결과: 미달 항목이 있어 verify/serve 빌드를 중단합니다"
        : "결과: 미달 항목이 있지만 off 모드라 배포를 막지 않습니다",
  ];
  return `${lines.join("\n")}\n`;
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = process.argv.slice(2);
  /** @param {string} name */
  const option = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const gate = checkPostDirectory(join(root, "src", "content", "posts"));
  const result = evaluateReadiness({
    distDir: option("--dist") ?? join(root, "dist"),
    mode: option("--mode"),
    origin: option("--origin"),
    env: process.env,
    gate,
  });
  process.stdout.write(
    args.includes("--json")
      ? `${JSON.stringify(result, null, 2)}\n`
      : formatReadiness(result)
  );
  if (!result.ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) main();
