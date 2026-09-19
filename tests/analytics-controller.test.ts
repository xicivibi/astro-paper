import assert from "node:assert/strict";
import test from "node:test";
import { createAnalyticsController } from "../src/scripts/analytics-controller.ts";

function fixture() {
  const calls: unknown[][] = [];
  let loads = 0;
  let stops = 0;
  const controller = createAnalyticsController("G-TEST123456", {
    command: (...args) => { calls.push(args); },
    load: () => { loads++; },
    stop: () => { stops++; },
  });
  return { controller, calls, loads: () => loads, stops: () => stops,
    views: () => calls.filter(call => call[0] === "event") };
}

test("no loader or views without consent, including repeated denial", () => {
  const f = fixture();
  f.controller.navigate({ url: "https://example.test/posts/a?private=1", title: "A" });
  f.controller.choose("denied");
  f.controller.choose("denied");
  assert.equal(f.loads(), 0);
  assert.equal(f.views().length, 0);
  assert.equal(f.calls[0][0], "consent");
  assert.equal((f.calls[0][2] as Record<string,string>).ad_user_data, "denied");
});

test("one loader and one view per navigation, no query/referrer leakage", () => {
  const f = fixture();
  f.controller.navigate({ url: "https://example.test/posts/a?private=1#part", title: "A" });
  f.controller.choose("granted");
  f.controller.choose("granted");
  f.controller.navigate({ url: "https://example.test/posts/a?private=2#other", title: "A" });
  assert.equal(f.loads(), 1);
  assert.equal(f.views().length, 1);
  assert.equal((f.views()[0][2] as Record<string,string>).page_location, "https://example.test/posts/a");
  f.controller.navigate({ url: "https://example.test/posts/b", title: "B" });
  f.controller.navigate({ url: "https://example.test/posts/a", title: "A" });
  assert.equal(f.views().length, 3);
  assert.equal(f.loads(), 1);
  assert.ok(!JSON.stringify(f.calls).includes("private="));
  const config = f.calls.find(call => call[0] === "config")!;
  assert.equal((config[2] as Record<string,unknown>).send_page_view, false);
  assert.equal((config[2] as Record<string,unknown>).page_referrer, "");
});

test("admin and search never load or emit, return after exclusion counts", () => {
  const f = fixture();
  f.controller.navigate({ url: "https://example.test/admin/", title: "Admin" });
  f.controller.choose("granted");
  f.controller.navigate({ url: "https://example.test/search/?q=secret", title: "Search" });
  assert.equal(f.loads(), 0);
  f.controller.navigate({ url: "https://example.test/posts/a", title: "A" });
  f.controller.navigate({ url: "https://example.test/admin/settings", title: "Admin" });
  f.controller.navigate({ url: "https://example.test/posts/a", title: "A" });
  assert.equal(f.views().length, 2);
});

test("revocation stops runtime and blocks later routes", () => {
  const f = fixture();
  f.controller.navigate({ url: "https://example.test/posts/a", title: "A" });
  f.controller.choose("granted");
  f.controller.choose("denied");
  f.controller.navigate({ url: "https://example.test/posts/b", title: "B" });
  assert.equal(f.stops(), 1);
  assert.equal(f.views().length, 1);
  assert.equal((f.calls.at(-1)![2] as Record<string,string>).analytics_storage, "denied");
});
