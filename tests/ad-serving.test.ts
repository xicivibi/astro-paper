import assert from "node:assert/strict";
import test from "node:test";
import {
  consentDefaultScript,
  isAdExcludedPath,
  resolveMonetization,
} from "../src/config/monetization.ts";
import { installAdSlots, pushNewSlots } from "../src/scripts/ad-slots.ts";
import {
  inlineScripts,
  scriptHash,
  serveHeaders,
} from "../scripts/serve-headers.mjs";

// Test-only identifiers: well-formed, not tied to a real account.
const serveEnv = {
  PUBLIC_ADSENSE_MODE: "serve",
  PUBLIC_ADSENSE_PUBLISHER_ID: "pub-9876543210987654",
  PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
  PUBLIC_ADSENSE_CMP: "google",
  PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE: "4815162342",
  PUBLIC_ADSENSE_SLOT_BEFORE_NAV: "2718281828",
};

test("serve mode needs all four conditions and real slot IDs", () => {
  const config = resolveMonetization(serveEnv);
  assert.equal(config.adsenseMode, "serve");
  assert.deepEqual(config.slots, {
    afterArticle: "4815162342",
    beforeNav: "2718281828",
  });
  const without = (key: string) => {
    const env: Record<string, string> = { ...serveEnv };
    delete env[key];
    return env;
  };
  assert.throws(
    () => resolveMonetization(without("PUBLIC_ADSENSE_CMP")),
    /CMP bootstrap/
  );
  assert.throws(
    () => resolveMonetization(without("PUBLIC_ADSENSE_PUBLISHER_ID")),
    /publisher ID/
  );
  assert.throws(
    () => resolveMonetization(without("PUBLIC_COMMERCIAL_HOSTING_CONFIRMED")),
    /hosting/
  );
  assert.throws(
    () => resolveMonetization(without("PUBLIC_ADSENSE_SLOT_BEFORE_NAV")),
    /ad unit IDs/
  );
  for (const slot of ["1234567890", "0000000000", "12345"]) {
    assert.throws(
      () =>
        resolveMonetization({
          ...serveEnv,
          PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE: slot,
        }),
      /ad unit IDs/
    );
  }
  assert.throws(
    () =>
      resolveMonetization({
        ...serveEnv,
        PUBLIC_ADSENSE_SLOT_BEFORE_NAV: "4815162342",
      }),
    /must differ/
  );
});

test("consent defaults start denied before any ad request", () => {
  const everywhere = consentDefaultScript("everywhere");
  assert.match(everywhere, /gtag\("consent","default",\{"ad_storage":"denied"/);
  assert.doesNotMatch(everywhere, /granted/);
  const eea = consentDefaultScript("eea");
  assert.match(eea, /"region":\["AT"/);
  assert.ok(eea.indexOf('"denied"') < eea.indexOf('"granted"'));
  assert.throws(
    () =>
      resolveMonetization({ ...serveEnv, PUBLIC_ADSENSE_CONSENT_SCOPE: "kr" }),
    /CONSENT_SCOPE/
  );
});

test("trust, tool, search and admin pages never load ads", () => {
  for (const path of [
    "/privacy/",
    "/contact/",
    "/about/",
    "/admin/",
    "/search/",
    "/404/",
    "/tools/",
    "/tools/csv-preview/",
    "/editorial-policy/",
  ]) {
    assert.equal(isAdExcludedPath(path), true, path);
  }
  for (const path of ["/posts/a/", "/", "/topics/excel-csv/"]) {
    assert.equal(isAdExcludedPath(path), false, path);
  }
});

function fakePage(count: number) {
  const slots = Array.from({ length: count }, () => ({
    dataset: {} as Record<string, string | undefined>,
  }));
  return {
    slots,
    querySelectorAll: (_selector: string) => slots,
  };
}

test("two client-side navigations push exactly once per slot", () => {
  const pushes: object[] = [];
  const queue = { push: (value: object) => pushes.push(value) };
  const first = fakePage(2);
  assert.equal(pushNewSlots(first, queue), 2);
  assert.equal(pushNewSlots(first, queue), 0);
  const second = fakePage(2);
  assert.equal(pushNewSlots(second, queue), 2);
  assert.equal(pushes.length, 4);

  // installAdSlots runs once immediately and again on each page-load event.
  const listeners: (() => void)[] = [];
  let page = fakePage(2);
  const doc = {
    querySelectorAll: (selector: string) => page.querySelectorAll(selector),
    addEventListener: (_type: string, listener: () => void) =>
      listeners.push(listener),
  };
  const win: { adsbygoogle?: { push: (value: object) => unknown } } = {};
  installAdSlots(win, doc);
  installAdSlots(win, doc); // a second install is ignored
  assert.equal(listeners.length, 1);
  listeners[0](); // page-load after the immediate run: no duplicate push
  assert.equal((win.adsbygoogle as unknown as object[]).length, 2);
  page = fakePage(2); // navigate
  listeners[0]();
  assert.equal((win.adsbygoogle as unknown as object[]).length, 4);
});

test("serve headers hash every executable inline script", () => {
  const html =
    '<script>a()</script><script type="module">b()</script>' +
    '<script type="application/ld+json">{"x":1}</script>' +
    '<script async src="https://example.org/x.js"></script>';
  assert.deepEqual(inlineScripts(html), ["a()", "b()"]);
  assert.match(scriptHash("a()"), /^'sha256-[A-Za-z0-9+/]+=*'$/);
  const headers = serveHeaders(
    "/*\n  Content-Security-Policy: default-src 'self'\n  X-Frame-Options: DENY\n",
    [scriptHash("a()")]
  );
  assert.match(
    headers,
    /script-src 'self' 'sha256-[^']+' https:; style-src 'self' 'unsafe-inline'/
  );
  assert.match(headers, /frame-src https:/);
  assert.doesNotMatch(headers, /script-src[^;]*'unsafe-inline'/);
  assert.match(headers, /X-Frame-Options: DENY/);
});
