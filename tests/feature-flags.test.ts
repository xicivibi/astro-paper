import assert from "node:assert/strict";
import test from "node:test";
import { isTrendPost, resolveFeatureFlags } from "../src/config/features.ts";

test("trend surfaces stay off unless explicitly enabled", () => {
  assert.equal(resolveFeatureFlags({}).trendSurfaces, false);
  assert.equal(
    resolveFeatureFlags({ PUBLIC_TREND_SURFACES: "false" }).trendSurfaces,
    false
  );
  assert.equal(
    resolveFeatureFlags({ PUBLIC_TREND_SURFACES: "true" }).trendSurfaces,
    true
  );
  assert.throws(
    () => resolveFeatureFlags({ PUBLIC_TREND_SURFACES: "yes" }),
    /must be true or false/
  );
});

test("any trend marker classifies a post as a frozen trend surface", () => {
  assert.equal(isTrendPost({ tags: ["excel"] }), false);
  assert.equal(isTrendPost({ tags: [" Trend "] }), true);
  assert.equal(isTrendPost({ marketplaceQuery: "에어컨" }), true);
  assert.equal(isTrendPost({ trendLifecycle: {} }), true);
  assert.equal(isTrendPost({ trendBundle: {} }), true);
});
