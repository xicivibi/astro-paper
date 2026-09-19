import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

function buildWithSiteUrl(siteUrl: string) {
  rmSync(new URL("../dist", import.meta.url), { recursive: true, force: true });
  return spawnSync("corepack pnpm exec astro build", {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    shell: true,
    env: { ...process.env, PUBLIC_SITE_URL: siteUrl },
  });
}

test("PUBLIC_SITE_URL selects and normalizes the deployment origin", () => {
  const build = buildWithSiteUrl("https://xici-example.pages.dev");
  assert.equal(build.status, 0, build.stderr || build.stdout);
  const html = readFileSync(
    new URL("../dist/index.html", import.meta.url),
    "utf8"
  );

  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/xici-example\.pages\.dev\/">/
  );
  assert.match(
    html,
    /<meta property="og:url" content="https:\/\/xici-example\.pages\.dev\/">/
  );
  assert.match(
    html,
    /<link rel="alternate" type="application\/rss\+xml" title="AI SEO Lab RSS" href="\/rss\.xml"/,
  );
  assert.match(
    readFileSync(new URL("../dist/rss.xml", import.meta.url), "utf8"),
    /<rss version="2\.0">.*<link>https:\/\/xici-example\.pages\.dev\//s,
  );
  assert.match(
    readFileSync(new URL("../dist/robots.txt", import.meta.url), "utf8"),
    /Sitemap: https:\/\/xici-example\.pages\.dev\/sitemap-index\.xml/
  );
  assert.match(
    readFileSync(new URL("../dist/sitemap-index.xml", import.meta.url), "utf8"),
    /https:\/\/xici-example\.pages\.dev\/sitemap-0\.xml/
  );
});

test("PUBLIC_SITE_URL rejects a URL containing a path", () => {
  const build = buildWithSiteUrl("https://xici-example.pages.dev/blog");

  assert.notEqual(build.status, 0);
  assert.match(build.stderr + build.stdout, /origin without a path/);
});

test("PUBLIC_SITE_URL rejects an insecure production origin", () => {
  const build = buildWithSiteUrl("http://xici-example.pages.dev");

  assert.notEqual(build.status, 0);
  assert.match(build.stderr + build.stdout, /HTTPS origin/);
});

test("PUBLIC_SITE_URL rejects an explicitly empty deployment value", () => {
  const build = buildWithSiteUrl("   ");

  assert.notEqual(build.status, 0);
  assert.match(build.stderr + build.stdout, /must not be empty/);
});
