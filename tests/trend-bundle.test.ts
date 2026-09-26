import assert from "node:assert/strict";
import test from "node:test";
import { activeTrendOffers, trendBundleSchema } from "../src/utils/trendBundle.ts";

const first = "a".repeat(64);
const second = "b".repeat(64);
const cited = (text: string, sourceIds = [first]) => ({ text, sourceIds });
const sample = () => ({
  schemaVersion: "trend-bundle-v1",
  candidateHash: "c".repeat(64),
  verifiedPackHash: "d".repeat(64),
  reviewOutputHash: "e".repeat(64),
  intentCluster: "excel csv update",
  observedAt: "2026-09-27T01:00:00Z",
  reviewDueAt: "2026-09-27T12:00:00Z",
  freshUntil: "2026-09-28T01:00:00Z",
  expiryAction: "noindex",
  valueBlock: "comparison",
  shortAnswer: cited("A source reports a CSV import change, so verify the version and workflow before acting."),
  context: cited("A second publisher adds context about the update and its timing for affected users.", [second]),
  valueRows: [
    { label: "Current workflow", explanation: cited("Check whether the source covers the same import path as your workbook today.") },
    { label: "Verification step", explanation: cited("Compare the publisher dates and verify the application version first.", [second]) },
  ],
  faq: [
    { question: "What changed in the workflow?", answer: cited("The available source excerpt describes a change in the CSV import workflow.") },
    { question: "What should I check first?", answer: cited("Check the report date and the application version described by the publisher.", [second]) },
  ],
  sourceCards: [
    { sourceId: first, title: "Excel CSV import update", publisher: "Microsoft Support", url: "https://support.microsoft.com/example", retrievedAt: "2026-09-27T01:02:00Z" },
    { sourceId: second, title: "Independent comparison", publisher: "Independent Publisher", url: "https://example.org/comparison", retrievedAt: "2026-09-27T01:03:00Z" },
  ],
  offers: [{
    offerId: "csv-tool-01",
    network: "coupang",
    productName: "CSV tool",
    destinationUrl: "https://link.coupang.com/a/example",
    disclosureText: "이 링크를 통한 구매 시 수수료를 받을 수 있습니다.",
    verifiedAt: "2026-09-27T01:00:00Z",
    expiresAt: "2026-09-28T01:00:00Z",
  }],
});

test("trend bundle accepts cited independent sources and a matching offer", () => {
  const bundle = trendBundleSchema.parse(sample());
  assert.equal(bundle.sourceCards.length, 2);
  assert.equal(activeTrendOffers(bundle, new Date("2026-09-27T10:00:00Z")).length, 1);
  assert.equal(activeTrendOffers(bundle, new Date("2026-09-28T01:00:00Z")).length, 0);
});

test("trend bundle rejects invented citation, unsafe affiliate host, and noncommercial offer", () => {
  const unknown = sample();
  unknown.shortAnswer.sourceIds = ["f".repeat(64)];
  assert.equal(trendBundleSchema.safeParse(unknown).success, false);

  const spoofed = sample();
  spoofed.offers[0].destinationUrl = "https://link.coupang.com.attacker.example/a";
  assert.equal(trendBundleSchema.safeParse(spoofed).success, false);

  const misplaced = sample();
  misplaced.valueBlock = "timeline";
  assert.equal(trendBundleSchema.safeParse(misplaced).success, false);
});

test("trend bundle rejects stale lifecycle, one publisher host, and undisclosed commission", () => {
  const stale = sample();
  stale.freshUntil = stale.observedAt;
  assert.equal(trendBundleSchema.safeParse(stale).success, false);

  const sameHost = sample();
  sameHost.sourceCards[1].url = "https://support.microsoft.com/other";
  assert.equal(trendBundleSchema.safeParse(sameHost).success, false);

  const undisclosed = sample();
  undisclosed.offers[0].disclosureText = "상품을 보러 가세요. 구매가 가능합니다.";
  assert.equal(trendBundleSchema.safeParse(undisclosed).success, false);
});
