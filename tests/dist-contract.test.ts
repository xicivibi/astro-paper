import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { buildSite, type SiteBuild } from "./helpers/siteBuild.ts";

const origin = "https://xici-test.example";
let site: SiteBuild;

before(() => {
  site = buildSite({ PUBLIC_SITE_URL: origin });
  assert.equal(site.status, 0, site.output);
});

after(() => site?.cleanup());

test("default build hides every frozen trend and marketplace surface", () => {
  const pages = site.htmlFiles();
  assert.ok(pages.length > 10);
  for (const page of pages) {
    const html = site.read(page);
    assert.doesNotMatch(html, /TREND WATCH/, page);
    assert.doesNotMatch(html, /coupang\.com/, page);
    assert.doesNotMatch(html, /googlesyndication|<ins class="adsbygoogle"/, page);
    // Match rendered elements only; the shared analytics bundle names these
    // selectors in code without rendering any offer.
    for (const marker of [
      "data-affiliate-offer",
      "data-marketplace-search",
      "data-trend-bundle",
      "data-trend-lifecycle",
    ]) {
      assert.doesNotMatch(
        html,
        new RegExp(`<[a-z][^>]*\\s${marker}[\\s>=]`),
        page
      );
    }
    assert.doesNotMatch(html, /href="\/tags\/trend\/"/, page);
  }
});

export const keptPostSlugs = [
  "csv-korean-encoding-delimiter-checklist",
  "excel-leading-zeros-large-identifiers-power-query",
  "power-query-csv-date-using-locale",
  "power-query-folder-combine-header-column-order",
  "power-query-left-anti-compare-lists",
  "power-query-remove-duplicates-key-normalization",
];

test("only the six reviewed posts remain public and indexable", () => {
  const postPages = site
    .htmlFiles()
    .filter(page => /^posts\/[^/]+\/index\.html$/.test(page))
    .filter(page => !/^posts\/\d+\/index\.html$/.test(page))
    .filter(page => page !== "posts/list/index.html");
  for (const page of postPages) {
    assert.doesNotMatch(
      site.read(page),
      /<meta name="robots" content="noindex/,
      page
    );
  }
  const sitemap = site.read("sitemap-0.xml");
  const postUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(match => match[1])
    .filter(url => new URL(url).pathname.startsWith("/posts/"))
    .filter(url => !/^\/posts\/(?:\d+\/|list\/)?$/.test(new URL(url).pathname))
    .sort();
  assert.deepEqual(
    postUrls,
    keptPostSlugs.map(slug => `${origin}/posts/${slug}/`).sort()
  );
});

test("autopilot and trend tag pages are gone", () => {
  const tagPages = site
    .htmlFiles()
    .filter(page => page.startsWith("tags/"))
    .map(page => decodeURIComponent(page.split("/")[1]));
  for (const banned of ["autopilot", "ai자동화", "google-trends", "trend"]) {
    assert.equal(tagPages.includes(banned), false, banned);
  }
});

test("home identity is about work data, not trends or shopping", () => {
  const html = site.read("index.html");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
  const description =
    /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? "";
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "";
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  for (const text of [title, description, h1]) {
    assert.ok(text.trim().length > 0);
    assert.doesNotMatch(text, /트렌드|구매|쇼핑/);
  }
  assert.match(description, /엑셀|Excel/);
  const tools = /data-home-tools[\s\S]*?<\/ul>/.exec(html)?.[0] ?? "";
  for (const slug of [
    "csv-preview",
    "identifier-check",
    "list-compare",
    "header-compare",
  ]) {
    assert.match(tools, new RegExp(`href="/tools/${slug}/"`));
  }
  assert.match(html, /data-home-hubs[\s\S]*?href="\/topics\/excel-csv\/"/);
  assert.match(html, /data-home-featured/);
});

const trustLinks = ["/about/", "/editorial-policy/", "/privacy/", "/contact/"];

test("every rendered page links to the four trust pages", () => {
  const pages = site
    .htmlFiles()
    .filter(page => /<html/.test(site.read(page)))
    .filter(page => !page.startsWith("admin/"));
  assert.ok(pages.length > 20);
  for (const page of pages) {
    const html = site.read(page);
    const footer = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? "";
    for (const href of trustLinks) {
      assert.match(footer, new RegExp(`href="${href}"`), `${page} ${href}`);
    }
  }
});

test("off mode keeps the honest not-ready operator and ad copy", () => {
  const privacy = site.read("privacy/index.html");
  assert.match(privacy, /data-ads-disclosure="off"/);
  assert.match(privacy, /이 버전에는 광고를 표시하지 않습니다/);
  assert.match(privacy, /공개 문의 채널은 준비 중입니다/);
  assert.doesNotMatch(privacy, /partner-sites/);
  const contact = site.read("contact/index.html");
  assert.match(contact, /공개 문의 채널 준비 중/);
  const about = site.read("about/index.html");
  assert.match(about, /data-operator-experience="pending"/);
  assert.match(about, /id="operator"/);
  assert.match(about, /사람이 직접 재현한 글만/);
  assert.doesNotMatch(about, /트렌드|구매 전/);
  assert.doesNotMatch(site.read("index.html"), /google-adsense-account/);
  assert.equal(
    site.read("ads.txt"),
    "# Advertising is not enabled on this deployment.\n"
  );
});

test("public posts carry a byline, human review status and og tags", () => {
  for (const slug of keptPostSlugs) {
    const html = site.read(`posts/${slug}/index.html`);
    assert.match(html, /data-post-byline[\s\S]*?href="\/about\/#operator"/);
    assert.match(html, /data-human-review>운영자 서명 전</);
    for (const property of ["og:title", "og:description", "og:image"]) {
      const match = new RegExp(
        `<meta property="${property}" content="([^"]+)"`
      ).exec(html);
      assert.ok(match && match[1].trim(), `${slug} ${property}`);
    }
    assert.match(html, new RegExp(`og:image" content="${origin}/`));
  }
});

test("search verification metas are absent without configuration", () => {
  for (const page of ["index.html", "about/index.html"]) {
    const html = site.read(page);
    assert.doesNotMatch(html, /naver-site-verification|msvalidate\.01/);
  }
});

test("RSS and sitemap use absolute URLs on the configured origin", () => {
  const rss = site.read("rss.xml");
  const links = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map(m => m[1]);
  assert.ok(links.length >= 7);
  for (const link of links) assert.ok(link.startsWith(`${origin}/`), link);
  for (const file of ["sitemap-index.xml", "sitemap-0.xml"]) {
    const locs = [...site.read(file).matchAll(/<loc>([^<]+)<\/loc>/g)];
    assert.ok(locs.length > 0);
    for (const [, loc] of locs) assert.ok(loc.startsWith(`${origin}/`), loc);
  }
});

test("Vercel 301 map preserves kept paths and skips deleted posts", async () => {
  const { buildRedirects, withRedirects } = await import(
    "../scripts/generate-vercel-redirects.mjs"
  );
  const target = "https://xici-site.kr";
  const redirects = buildRedirects(site.read("sitemap-0.xml"), target);
  const bySource = new Map(
    redirects.map((item: { source: string }) => [item.source, item])
  );
  for (const item of redirects) {
    assert.equal(item.statusCode, 301);
    assert.ok(item.destination.startsWith(`${target}/`));
  }
  const kept = [
    "/",
    "/about/",
    "/privacy/",
    "/tools/csv-preview/",
    "/topics/excel-csv/",
    "/rss.xml",
    ...keptPostSlugs.map(slug => `/posts/${slug}/`),
  ];
  for (const path of kept) {
    const item = bySource.get(path) as { destination: string } | undefined;
    assert.ok(item, path);
    assert.equal(item.destination, `${target}${path}`);
  }
  assert.ok(bySource.has(`/posts/${keptPostSlugs[0]}`));
  for (const deleted of [
    "post-20260522-133242-18842b6cde",
    "post-20260523-065936-bd9c476746",
    "xici-trend-ed0e90733d1a21cf0b03",
    "air-conditioner-total-cost-checklist-2026",
    "online-meat-delivery-checklist-2026",
  ]) {
    assert.equal(bySource.has(`/posts/${deleted}/`), false, deleted);
    assert.equal(bySource.has(`/posts/${deleted}`), false, deleted);
  }
  const merged = withRedirects({ headers: [{ source: "/(.*)" }] }, redirects);
  assert.equal(merged.headers.length, 1);
  assert.throws(
    () => buildRedirects("", "https://xici.vercel.app"),
    /new HTTPS origin/
  );
});

test("public pages ship the OFL Pretendard web font, never the company font", () => {
  const fonts = readdirSync(join(site.outDir, "fonts")).sort();
  assert.deepEqual(fonts, ["OFL.txt", "Pretendard-Regular.woff2"]);
  const css = readdirSync(join(site.outDir, "_astro"))
    .filter(name => name.endsWith(".css"))
    .map(name => site.read(join("_astro", name)))
    .join("\n");
  assert.match(css, /font-family:\s*"?Pretendard"?;[^}]*\/fonts\/Pretendard-Regular\.woff2/);
  assert.doesNotMatch(css, /Hanjin/i);
  for (const page of site.htmlFiles()) {
    assert.doesNotMatch(site.read(page), /Hanjin/i, page);
  }
  assert.ok(statSync(join(site.outDir, "og.png")).size > 0);
});
