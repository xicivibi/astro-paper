import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildSite, type SiteBuild } from "./helpers/siteBuild.ts";

// Test-only identifiers: well-formed but not tied to any real account.
const origin = "https://xici-test.example";
const publisherId = "pub-9876543210987654";
const verifyEnv = {
  PUBLIC_SITE_URL: origin,
  PUBLIC_HOSTING_PROVIDER: "cloudflare",
  PUBLIC_ADSENSE_MODE: "verify",
  PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
  PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
  PUBLIC_OPERATOR_NAME: "테스트 운영자",
  PUBLIC_OPERATOR_EMAIL: "contact@xici-test.example",
  PUBLIC_NAVER_SITE_VERIFICATION: "3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a",
  PUBLIC_BING_SITE_VERIFICATION: "8D2F4A6C1E3B5D7F9A0C2E4B6D8F1A3C",
};
let site: SiteBuild;

before(() => {
  site = buildSite(verifyEnv);
  assert.equal(site.status, 0, site.output);
});

after(() => site?.cleanup());

test("verify mode publishes the account meta and a one-line ads.txt", () => {
  const home = site.read("index.html");
  assert.equal(
    (home.match(/<meta name="google-adsense-account"/g) ?? []).length,
    1
  );
  assert.match(home, new RegExp(`content="ca-${publisherId}"`));
  assert.doesNotMatch(home, /adsbygoogle\.js/);
  assert.equal(
    site.read("ads.txt"),
    `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
  );
});

test("verify mode privacy page explains third-party ad cookies", () => {
  const privacy = site.read("privacy/index.html");
  assert.match(privacy, /data-ads-disclosure="verify"/);
  assert.match(
    privacy,
    /href="https:\/\/policies\.google\.com\/technologies\/partner-sites"/
  );
  assert.match(privacy, /href="https:\/\/adssettings\.google\.com\/"/);
  assert.match(privacy, /승인 전에는 광고를 표시하지 않습니다/);
  assert.match(privacy, /Cloudflare/);
  assert.match(privacy, /mailto:contact@xici-test\.example/);
  assert.match(site.read("contact/index.html"), /contact@xici-test\.example/);
});

test("configured Naver and Bing verification metas appear exactly once", () => {
  for (const page of ["index.html", "about/index.html", "privacy/index.html"]) {
    const html = site.read(page);
    assert.equal(
      (html.match(/<meta name="naver-site-verification"/g) ?? []).length,
      1,
      page
    );
    assert.equal(
      (html.match(/<meta name="msvalidate\.01"/g) ?? []).length,
      1,
      page
    );
  }
});

test("verify mode refuses to build without a public operator email", () => {
  const { PUBLIC_OPERATOR_EMAIL: _omitted, ...withoutEmail } = verifyEnv;
  const failed = buildSite(withoutEmail);
  try {
    assert.notEqual(failed.status, 0);
    assert.match(failed.output, /PUBLIC_OPERATOR_EMAIL/);
  } finally {
    failed.cleanup();
  }
});
