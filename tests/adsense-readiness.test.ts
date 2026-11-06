import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateReadiness,
  formatReadiness,
} from "../scripts/adsense-readiness.mjs";

type FixtureOptions = {
  origin?: string;
  posts?: number;
  experience?: "written" | "pending";
  ads?: string;
};

function fixtureDist(options: FixtureOptions = {}) {
  const origin = options.origin ?? "https://xici-site.kr";
  const posts = options.posts ?? 20;
  const dir = mkdtempSync(join(tmpdir(), "xici-ready-"));
  const write = (path: string, body: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  write(
    "index.html",
    `<html><head><link rel="canonical" href="${origin}/"></head></html>`
  );
  for (const page of ["about", "privacy", "contact", "editorial-policy"]) {
    write(
      `${page}/index.html`,
      page === "about"
        ? `<html><div data-operator-experience="${options.experience ?? "written"}"></div></html>`
        : "<html></html>"
    );
  }
  const urls = [
    `${origin}/`,
    `${origin}/posts/`,
    `${origin}/posts/2/`,
    `${origin}/posts/list/`,
    ...Array.from(
      { length: posts },
      (_, index) => `${origin}/posts/guide-${index}/`
    ),
  ];
  write(
    "sitemap-0.xml",
    `<urlset>${urls.map(url => `<url><loc>${url}</loc></url>`).join("")}</urlset>`
  );
  write(
    "sitemap-index.xml",
    `<sitemapindex><sitemap><loc>${origin}/sitemap-0.xml</loc></sitemap></sitemapindex>`
  );
  write(
    "robots.txt",
    `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap-index.xml\n`
  );
  write(
    "ads.txt",
    options.ads ?? "google.com, pub-9876543210987654, DIRECT, f08c47fec0942fa0\n"
  );
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const readyEnv = { PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr" };
const cleanGate = { errors: [], warnings: [] };

function failing(result: ReturnType<typeof evaluateReadiness>) {
  return result.checks.filter(check => !check.pass).map(check => check.id);
}

test("a complete verify build is ready", () => {
  const dist = fixtureDist();
  try {
    const result = evaluateReadiness({
      distDir: dist.dir,
      mode: "verify",
      env: readyEnv,
      gate: cleanGate,
    });
    assert.deepEqual(failing(result), []);
    assert.equal(result.ok, true);
  } finally {
    dist.cleanup();
  }
});

test("19 public posts fail verify mode but never block off mode", () => {
  const dist = fixtureDist({ posts: 19, ads: "# off\n" });
  try {
    const verify = evaluateReadiness({
      distDir: dist.dir,
      mode: "verify",
      env: readyEnv,
      gate: cleanGate,
    });
    assert.deepEqual(failing(verify), ["public-posts", "ads-txt"]);
    assert.equal(verify.ok, false);
    const posts = verify.checks.find(check => check.id === "public-posts")!;
    assert.deepEqual(posts.evidence, { count: 19, required: 20 });

    const off = evaluateReadiness({
      distDir: dist.dir,
      mode: "off",
      env: readyEnv,
      gate: cleanGate,
    });
    assert.equal(off.ready, false);
    assert.equal(off.enforced, false);
    assert.equal(off.ok, true);
    assert.match(formatReadiness(off), /off 모드라 배포를 막지 않습니다/);
  } finally {
    dist.cleanup();
  }
});

test("shared subdomains are not an AdSense site", () => {
  for (const origin of [
    "https://xici.pages.dev",
    "https://xici.vercel.app",
    "https://xicivibi.github.io",
  ]) {
    const dist = fixtureDist({ origin });
    try {
      const result = evaluateReadiness({
        distDir: dist.dir,
        mode: "verify",
        env: readyEnv,
        gate: cleanGate,
      });
      assert.deepEqual(failing(result), ["own-domain"], origin);
      const check = result.checks.find(item => item.id === "own-domain")!;
      assert.equal(check.evidence.origin, origin);
      assert.ok(String(check.evidence.sharedSuffix).length > 0);
    } finally {
      dist.cleanup();
    }
  }
});

test("missing owner inputs and gate warnings are reported with evidence", () => {
  const dist = fixtureDist({ experience: "pending" });
  try {
    const result = evaluateReadiness({
      distDir: dist.dir,
      mode: "verify",
      env: { PUBLIC_OPERATOR_EMAIL: "owner@example.com" },
      gate: { errors: [], warnings: [{}, {}] },
    });
    assert.deepEqual(failing(result), [
      "operator-email",
      "owner-experience",
      "quality-gate",
    ]);
    const json = JSON.parse(JSON.stringify(result));
    for (const check of json.checks) {
      assert.equal(typeof check.evidence, "object", check.id);
    }
    const gate = json.checks.find(
      (check: { id: string }) => check.id === "quality-gate"
    );
    assert.deepEqual(gate.evidence, { errors: 0, warnings: 2 });
    const email = json.checks.find(
      (check: { id: string }) => check.id === "operator-email"
    );
    assert.equal(email.evidence.configured, "o***@example.com");
  } finally {
    dist.cleanup();
  }
});

test("the built mode is inferred from the HTML when no variable is set", () => {
  const dist = fixtureDist();
  try {
    writeFileSync(
      join(dist.dir, "index.html"),
      '<html><head><link rel="canonical" href="https://xici-site.kr/"><meta name="google-adsense-account" content="ca-pub-9876543210987654"></head></html>'
    );
    const result = evaluateReadiness({
      distDir: dist.dir,
      env: {},
      gate: cleanGate,
    });
    assert.equal(result.mode, "verify");
    assert.equal(result.enforced, true);
    assert.equal(result.ok, false);
  } finally {
    dist.cleanup();
  }
});
