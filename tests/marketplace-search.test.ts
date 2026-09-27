import assert from "node:assert/strict";
import test from "node:test";
import { coupangSearchUrl } from "../src/utils/marketplaceSearch.ts";

test("marketplace link searches the selected topic on the fixed merchant host", () => {
  const link = coupangSearchUrl("냉장 소고기");
  assert.ok(link);
  const url = new URL(link);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "www.coupang.com");
  assert.equal(url.pathname, "/np/search");
  assert.equal(url.searchParams.get("q"), "냉장 소고기");
});

test("invalid search terms cannot become marketplace destinations", () => {
  for (const term of ["", "a", " x", "x ", "a\nb", "x".repeat(61)]) {
    assert.equal(coupangSearchUrl(term), null);
  }
});
