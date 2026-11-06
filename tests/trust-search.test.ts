import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOperatorForAds,
  resolveOperator,
} from "../src/config/operator.ts";
import { resolveSearchVerification } from "../src/config/searchVerification.ts";
import { GET as robotsRoute } from "../src/pages/robots.txt.ts";

test("PUBLIC_OPERATOR_* settings win over the legacy names", () => {
  const operator = resolveOperator({
    PUBLIC_OPERATOR_NAME: " 운영자 ",
    PUBLIC_CREATOR_NAME: "old",
    PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr",
    PUBLIC_CONTACT_EMAIL: "old@xici-site.kr",
  });
  assert.equal(operator.creatorName, "운영자");
  assert.equal(operator.email, "contact@xici-site.kr");
  assert.equal(
    resolveOperator({ PUBLIC_CONTACT_EMAIL: "legacy@xici-site.kr" }).email,
    "legacy@xici-site.kr"
  );
});

test("verify and serve builds need a real public operator email", () => {
  const none = resolveOperator({});
  assert.doesNotThrow(() => assertOperatorForAds("off", none));
  for (const mode of ["verify", "serve"] as const) {
    assert.throws(() => assertOperatorForAds(mode, none), /OPERATOR_EMAIL/);
    assert.throws(
      () =>
        assertOperatorForAds(
          mode,
          resolveOperator({ PUBLIC_OPERATOR_EMAIL: "owner@example.com" })
        ),
      /OPERATOR_EMAIL/
    );
    assert.doesNotThrow(() =>
      assertOperatorForAds(
        mode,
        resolveOperator({ PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr" })
      )
    );
  }
});

test("search verification metas appear only for real tokens", () => {
  assert.deepEqual(resolveSearchVerification({}), []);
  assert.deepEqual(
    resolveSearchVerification({
      PUBLIC_NAVER_SITE_VERIFICATION: "3f9a1c7e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a",
      PUBLIC_BING_SITE_VERIFICATION: "8D2F4A6C1E3B5D7F9A0C2E4B6D8F1A3C",
    }).map(meta => meta.name),
    ["naver-site-verification", "msvalidate.01"]
  );
  for (const value of [
    "xxxxxxxxxxxxxxxxxxxx",
    "your-naver-verification-code",
    "0000000000000000",
    "short",
    "has spaces in the token value",
    "<script>alert(1)</script>",
  ]) {
    assert.throws(
      () => resolveSearchVerification({ PUBLIC_NAVER_SITE_VERIFICATION: value }),
      /real verification token/,
      value
    );
  }
});

/** Minimal robots.txt evaluation: the most specific matching group wins. */
function isAllowed(robots: string, userAgent: string, path: string) {
  const groups: { agents: string[]; rules: [string, string][] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, field, value] = match;
    if (field.toLowerCase() === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && /^(allow|disallow)$/i.test(field)) {
      current.rules.push([field.toLowerCase(), value]);
      lastWasAgent = false;
    }
  }
  const agent = userAgent.toLowerCase();
  const group =
    groups.find(item => item.agents.some(name => agent.includes(name))) ??
    groups.find(item => item.agents.includes("*"));
  if (!group) return true;
  let best: [string, string] | null = null;
  for (const rule of group.rules) {
    if (rule[1] && path.startsWith(rule[1])) {
      if (!best || rule[1].length > best[1].length) best = rule;
    }
  }
  return !best || best[0] === "allow";
}

test("robots.txt lets Googlebot, Naver Yeti and Bingbot crawl public pages", async () => {
  const response = robotsRoute({
    site: new URL("https://xici-test.example/"),
  } as never) as Response;
  const robots = await response.text();
  for (const agent of ["Googlebot", "Yeti", "Bingbot"]) {
    for (const path of ["/", "/posts/csv-korean-encoding-delimiter-checklist/"]) {
      assert.equal(isAllowed(robots, agent, path), true, `${agent} ${path}`);
    }
    assert.equal(isAllowed(robots, agent, "/admin/"), false);
  }
  assert.match(robots, /Sitemap: https:\/\/xici-test\.example\/sitemap-index\.xml/);
});
