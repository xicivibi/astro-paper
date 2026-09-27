import { z } from "astro/zod";

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const safeText = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine(
      value => value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value),
      "Text must be trimmed and printable"
    );

function httpsHost(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      url.hostname
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}

const sourcedText = z
  .object({
    text: safeText(40, 800),
    sourceIds: z.array(sha256).min(1).max(8),
  })
  .strict();

const sourceCard = z
  .object({
    sourceId: sha256,
    title: safeText(1, 300),
    publisher: safeText(1, 200),
    url: z
      .string()
      .max(2000)
      .refine(value => httpsHost(value) !== null),
    retrievedAt: z.coerce.date(),
  })
  .strict();

const offerCard = z
  .object({
    offerId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    network: z.enum(["coupang", "aliexpress"]),
    productName: safeText(1, 180),
    destinationUrl: z.string().max(700),
    disclosureText: safeText(15, 300),
    verifiedAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
  })
  .strict()
  .superRefine((offer, context) => {
    const host = httpsHost(offer.destinationUrl);
    const expected =
      offer.network === "coupang"
        ? "link.coupang.com"
        : "s.click.aliexpress.com";
    if (host !== expected) {
      context.addIssue({
        code: "custom",
        message: "Offer URL has an unapproved network host",
      });
    }
    if (
      offer.expiresAt <= offer.verifiedAt ||
      offer.expiresAt.getTime() - offer.verifiedAt.getTime() > 30 * 86400000
    ) {
      context.addIssue({
        code: "custom",
        message: "Offer verification must expire within 30 days",
      });
    }
    if (
      !offer.disclosureText.includes("수수료") ||
      !offer.disclosureText.includes("받을 수")
    ) {
      context.addIssue({
        code: "custom",
        message: "Offer needs an adjacent commission disclosure",
      });
    }
  });

export const trendBundleSchema = z
  .object({
    schemaVersion: z.literal("trend-bundle-v1"),
    candidateHash: sha256,
    verifiedPackHash: sha256,
    reviewOutputHash: sha256,
    intentCluster: safeText(1, 240),
    observedAt: z.coerce.date(),
    freshUntil: z.coerce.date(),
    reviewDueAt: z.coerce.date(),
    expiryAction: z.enum(["noindex", "archive", "refresh"]),
    valueBlock: z.enum(["comparison", "timeline", "calculator", "checklist"]),
    shortAnswer: sourcedText,
    context: sourcedText,
    valueRows: z
      .array(
        z
          .object({
            label: safeText(4, 120),
            explanation: sourcedText,
          })
          .strict()
      )
      .min(2)
      .max(6),
    faq: z
      .array(
        z
          .object({
            question: safeText(8, 200),
            answer: sourcedText,
          })
          .strict()
      )
      .min(2)
      .max(4),
    sourceCards: z.array(sourceCard).min(2).max(8),
    offers: z.array(offerCard).max(3).default([]),
  })
  .strict()
  .superRefine((bundle, context) => {
    if (
      bundle.observedAt >= bundle.freshUntil ||
      bundle.reviewDueAt > bundle.freshUntil ||
      bundle.reviewDueAt < bundle.observedAt ||
      bundle.freshUntil.getTime() - bundle.observedAt.getTime() > 30 * 86400000
    ) {
      context.addIssue({
        code: "custom",
        message: "Trend lifecycle dates are inconsistent",
      });
    }
    const ids = bundle.sourceCards.map(source => source.sourceId);
    const hosts = bundle.sourceCards.map(source => httpsHost(source.url));
    if (new Set(ids).size !== ids.length || new Set(hosts).size < 2) {
      context.addIssue({
        code: "custom",
        message: "Trend sources need unique IDs and independent hosts",
      });
    }
    const known = new Set(ids);
    const cited = new Set<string>();
    const paragraphs = [
      bundle.shortAnswer,
      bundle.context,
      ...bundle.valueRows.map(row => row.explanation),
      ...bundle.faq.map(item => item.answer),
    ];
    for (const paragraph of paragraphs) {
      if (
        new Set(paragraph.sourceIds).size !== paragraph.sourceIds.length ||
        paragraph.sourceIds.some(id => !known.has(id))
      ) {
        context.addIssue({
          code: "custom",
          message: "Bundle paragraph cites an unknown or repeated source",
        });
      }
      paragraph.sourceIds.forEach(id => cited.add(id));
    }
    const citedHosts = new Set(
      bundle.sourceCards
        .filter(source => cited.has(source.sourceId))
        .map(source => httpsHost(source.url))
    );
    if (citedHosts.size < 2) {
      context.addIssue({
        code: "custom",
        message: "Bundle content must cite two publisher hosts",
      });
    }
    if (
      new Set(bundle.offers.map(offer => offer.offerId)).size !==
        bundle.offers.length ||
      new Set(bundle.offers.map(offer => offer.destinationUrl)).size !==
        bundle.offers.length ||
      (bundle.offers.length > 0 &&
        !["comparison", "checklist"].includes(bundle.valueBlock))
    ) {
      context.addIssue({
        code: "custom",
        message: "Offers must be unique and match commercial utility",
      });
    }
  });

export type TrendBundle = z.infer<typeof trendBundleSchema>;

export function activeTrendOffers(
  bundle: TrendBundle,
  now: Date,
  commercialHostingConfirmed: boolean
) {
  if (!commercialHostingConfirmed || now >= bundle.freshUntil) return [];
  return bundle.offers.filter(
    offer => offer.verifiedAt <= now && now < offer.expiresAt
  );
}
