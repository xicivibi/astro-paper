import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { buildSite, projectRoot, type SiteBuild } from "./helpers/siteBuild.ts";
import {
  collectInlineHashes,
  inlineScripts,
  scriptHash,
  serveHeaders,
} from "../scripts/serve-headers.mjs";

// Test-only identifiers: well-formed but not tied to any real account.
const origin = "https://xici-test.example";
const publisherId = "pub-9876543210987654";
const loader = "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
// A loader *tag*; the consent-reset script names the URL in code on every page.
const loaderTag =
  /<script[^>]*src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"]*"/g;
let site: SiteBuild;

before(() => {
  site = buildSite({
    PUBLIC_SITE_URL: origin,
    PUBLIC_HOSTING_PROVIDER: "cloudflare",
    PUBLIC_ADSENSE_MODE: "serve",
    PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
    PUBLIC_ADSENSE_CMP: "google",
    PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE: "4815162342",
    PUBLIC_ADSENSE_SLOT_BEFORE_NAV: "2718281828",
    PUBLIC_OPERATOR_EMAIL: "contact@xici-test.example",
  });
  assert.equal(site.status, 0, site.output);
});

after(() => site?.cleanup());

const count = (html: string, pattern: RegExp) =>
  (html.match(pattern) ?? []).length;

test("post pages load the ad script once, after the consent default", () => {
  const html = site.read(
    "posts/csv-korean-encoding-delimiter-checklist/index.html"
  );
  assert.equal(count(html, loaderTag), 1);
  assert.ok(html.includes(loader));
  assert.equal(count(html, /<ins class="adsbygoogle"/g), 2);
  assert.ok(count(html, /<ins class="adsbygoogle"/g) <= 2);
  const consent = html.indexOf('gtag("consent","default"');
  const loaderAt = html.search(/<script[^>]*src="https:\/\/pagead2/);
  assert.ok(consent > 0 && consent < loaderAt, "consent default precedes the loader");
  assert.match(html, /data-ad-slot="4815162342"/);
  assert.match(html, /data-ad-slot="2718281828"/);
  assert.match(html, /min-height:280px/);
  assert.match(html, new RegExp(`data-ad-client="ca-${publisherId}"`));
});

test("excluded and non-article pages never load the ad script", () => {
  const pages = site
    .htmlFiles()
    .filter(page => !page.startsWith("posts/") || /^posts\/(?:\d+\/|list\/)?index\.html$/.test(page));
  assert.ok(pages.length > 10);
  for (const page of pages) {
    assert.equal(count(site.read(page), loaderTag), 0, page);
  }
  for (const page of [
    "privacy/index.html",
    "contact/index.html",
    "about/index.html",
    "admin/index.html",
    "search/index.html",
    "404.html",
    "tools/index.html",
    "tools/csv-preview/index.html",
  ]) {
    assert.equal(count(site.read(page), loaderTag), 0, page);
    assert.doesNotMatch(site.read(page), /<ins class="adsbygoogle"/, page);
  }
});

test("serve privacy page links partner sites and reopens consent", () => {
  const privacy = site.read("privacy/index.html");
  assert.match(privacy, /data-ads-disclosure="serve"/);
  assert.match(
    privacy,
    /href="https:\/\/policies\.google\.com\/technologies\/partner-sites"/
  );
  assert.match(privacy, /<button[^>]*data-ad-privacy-settings/);
  assert.match(privacy, /showRevocationMessage/);
  const footer = /<footer[\s\S]*<\/footer>/.exec(site.read("index.html"))?.[0];
  assert.match(String(footer), /data-ad-privacy-settings/);
});

test("ads.txt is one publisher line", () => {
  assert.equal(
    site.read("ads.txt"),
    `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
  );
});

test("serve CSP hashes match the inline scripts actually shipped", () => {
  const hashes = collectInlineHashes(site.outDir);
  const base = readFileSync(`${projectRoot}/deploy/cloudflare-headers`, "utf8");
  const headers = serveHeaders(base, hashes);
  const policy = /Content-Security-Policy: (.*)/.exec(headers)?.[1] ?? "";
  const scriptSrc = /script-src ([^;]*)/.exec(policy)?.[1] ?? "";
  const listed = new Set(scriptSrc.match(/'sha256-[^']+'/g) ?? []);
  const shipped = new Set<string>();
  for (const page of site.htmlFiles()) {
    for (const body of inlineScripts(site.read(page))) {
      shipped.add(scriptHash(body));
    }
  }
  assert.ok(shipped.size > 0);
  assert.deepEqual([...listed].sort(), [...shipped].sort());
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.match(policy, /frame-src https:/);
  assert.doesNotMatch(policy, /localhost|127\.0\.0\.1/);
});

test("static headers drop the local admin API from production", () => {
  const cloudflare = readFileSync(
    `${projectRoot}/deploy/cloudflare-headers`,
    "utf8"
  );
  const vercel = readFileSync(`${projectRoot}/vercel.json`, "utf8");
  for (const text of [cloudflare, vercel]) {
    assert.doesNotMatch(text, /localhost|127\.0\.0\.1/);
  }
});
