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
    /<link rel="alternate" type="application\/rss\+xml" title="직장인 자동화 실험실 RSS" href="\/rss\.xml"/,
  );
  assert.match(
    html,
    /<h1[^>]*>\s*Excel·CSV 실무 문제 해결\s*<\/h1>/
  );
  assert.match(html, /href="\/tools\/"[^>]*>\s*도구\s*<\/a>/);
  assert.match(html, /href="\/topics\/excel-csv\/"[\s\S]*?공개 글 6개/);
  assert.doesNotMatch(
    html,
    /SEO News Board|Fact Pack|수익화 실험|href="\/briefs\/"|Google Sheets·Apps Script|문서·웹 업무/
  );

  const topicsHtml = readFileSync(
    new URL("../dist/topics/index.html", import.meta.url),
    "utf8"
  );
  assert.match(topicsHtml, /Excel·CSV[\s\S]*?공개 글 6개/);
  assert.doesNotMatch(
    topicsHtml,
    /Google Sheets·Apps Script|문서·웹 업무/
  );

  const toolsHtml = readFileSync(
    new URL("../dist/tools/index.html", import.meta.url),
    "utf8"
  );
  assert.match(toolsHtml, /업무 도구/);
  assert.match(toolsHtml, /href="\/tools\/csv-preview\/"/);
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
  const article = readFileSync(
    new URL(
      "../dist/posts/excel-leading-zeros-large-identifiers-power-query/index.html",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(
    article,
    /"mainEntityOfPage":\{"@type":"WebPage","@id":"https:\/\/xici-example\.pages\.dev\/posts\/excel-leading-zeros-large-identifiers-power-query\/"\}/
  );
  assert.doesNotMatch(html + article, /cdn\.jsdelivr\.net/);
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
