import assert from "node:assert/strict";
import test from "node:test";
import { resolveMonetization, adsTxt } from "../src/config/monetization.ts";

test("IDs alone do not activate ads or analytics", () => {
  const config = resolveMonetization({
    PUBLIC_ADSENSE_PUBLISHER_ID: "pub-1234567890123456",
    PUBLIC_GA4_MEASUREMENT_ID: "G-ABCDEFG123",
  });
  assert.equal(config.adsenseMode, "off");
  assert.equal(config.analyticsEnabled, false);
  assert.equal(config.publisherId, "");
  assert.ok(!adsTxt(config).includes("google.com,"));
});

test("placeholder IDs and unconfirmed hosting cannot activate AdSense", () => {
  for (const id of ["pub-0000000000000000", "pub-1111111111111111", "pub-1234567890123456", "malformed"]) {
    assert.throws(() => resolveMonetization({
      PUBLIC_ADSENSE_MODE: "verify", PUBLIC_ADSENSE_PUBLISHER_ID: id,
      PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
    }));
  }
  assert.throws(() => resolveMonetization({
    PUBLIC_ADSENSE_MODE: "verify", PUBLIC_ADSENSE_PUBLISHER_ID: "pub-9876543210987654",
  }), /hosting/);
});

test("verification outputs exact seller identity without implying ad serving", () => {
  const config = resolveMonetization({
    PUBLIC_ADSENSE_MODE: "verify", PUBLIC_ADSENSE_PUBLISHER_ID: "ca-pub-9876543210987654",
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
  });
  assert.equal(config.adsenseMode, "verify");
  assert.equal(adsTxt(config), "google.com, pub-9876543210987654, DIRECT, f08c47fec0942fa0\n");
});

test("analytics requires explicit true and a valid stream ID", () => {
  assert.equal(resolveMonetization({ PUBLIC_ANALYTICS_ENABLED: "false" }).analyticsEnabled, false);
  assert.throws(() => resolveMonetization({ PUBLIC_ANALYTICS_ENABLED: "true" }));
  assert.throws(() => resolveMonetization({ PUBLIC_ANALYTICS_ENABLED: "true", PUBLIC_GA4_MEASUREMENT_ID: "G-ABCDEFG123" }));
  assert.equal(resolveMonetization({ PUBLIC_ANALYTICS_ENABLED: "true", PUBLIC_GA4_MEASUREMENT_ID: "G-A9B8C7D6E5", PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true", PUBLIC_GA4_AUTOMATIC_MEASUREMENT_DISABLED: "true" }).analyticsEnabled, true);
});

test("known GA4 documentation and project examples cannot activate Analytics", () => {
  for (const id of ["G-XXXXXXXXXX", "G-ABCDEFG123", "G-TEST123456", "G-EXAMPLE123", "G-0000000000"]) {
    assert.throws(() => resolveMonetization({ PUBLIC_ANALYTICS_ENABLED: "true", PUBLIC_GA4_MEASUREMENT_ID: id, PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true", PUBLIC_GA4_AUTOMATIC_MEASUREMENT_DISABLED: "true" }));
  }
});

test("ads cannot serve before a real CMP bootstrap is integrated", () => {
  assert.throws(() => resolveMonetization({ PUBLIC_ADSENSE_MODE: "serve", PUBLIC_ADSENSE_PUBLISHER_ID: "pub-9876543210987654", PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true" }), /CMP bootstrap/);
});
