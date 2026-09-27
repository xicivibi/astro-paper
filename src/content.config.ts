import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";
import { trendBundleSchema } from "@/utils/trendBundle";

export const BLOG_PATH = "src/content/posts";
const httpUrl = z.string().refine(
  value => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  },
  { message: "sources must use valid http or https URLs" }
);
const reproductionManifestPath = z
  .string()
  .regex(
    /^\/reproduction\/[a-z0-9][a-z0-9._-]{0,80}\/[a-f0-9]{64}\/manifest\.json$/
  );
const internalToolPath = z.string().regex(/^\/tools\/[a-z0-9][a-z0-9/-]*\/$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: z.date(),
        modDatetime: z.date().optional().nullable(),
        title: z.string(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        editorialStatus: z
          .enum(["published", "legacy_hold"])
          .default("published"),
        tags: z.array(z.string()).default(["others"]),
        ogImage: image().or(z.string()).optional(),
        description: z.string(),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().optional(),
        aiAssisted: z.boolean().optional(),
        lastReviewed: z.date().optional().nullable(),
        sources: z.array(httpUrl).max(8).optional(),
        testingStatus: z
          .enum([
            "not_tested",
            "reproduced",
            "official_source_only",
            "publisher_source_only",
          ])
          .default("not_tested"),
        correctionNote: z.string().optional(),
        marketplaceQuery: z
          .string()
          .min(2)
          .max(60)
          .refine(
            value =>
              value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value)
          )
          .optional(),
        trendBundle: trendBundleSchema.optional(),
        trendLifecycle: z
          .object({
            observedAt: z.coerce.date(),
            reviewDueAt: z.coerce.date(),
            freshUntil: z.coerce.date(),
          })
          .refine(
            value =>
              value.observedAt < value.reviewDueAt &&
              value.reviewDueAt <= value.freshUntil &&
              value.freshUntil.getTime() - value.observedAt.getTime() <=
                30 * 86400000,
            { message: "manual trend lifecycle must be ordered within 30 days" }
          )
          .optional(),
        reproductionKit: z
          .object({
            manifestPath: reproductionManifestPath,
            sha256,
            toolPath: internalToolPath.optional(),
          })
          .optional(),
      })
      .superRefine((data, context) => {
        if (
          data.marketplaceQuery &&
          (!data.tags.includes("trend") ||
            (!data.trendLifecycle && !data.trendBundle))
        ) {
          context.addIssue({
            code: "custom",
            message: "Marketplace query requires a trend lifecycle or bundle",
          });
        }
        if (
          data.tags.includes("trend") &&
          Boolean(data.trendBundle) === Boolean(data.trendLifecycle)
        ) {
          context.addIssue({
            code: "custom",
            message: "trend posts require exactly one lifecycle source",
          });
        }
        if (!data.trendBundle) return;
        const sourceUrls = data.trendBundle.sourceCards.map(
          source => source.url
        );
        if (
          data.draft === true ||
          data.editorialStatus !== "published" ||
          data.aiAssisted !== true ||
          data.testingStatus !== "publisher_source_only" ||
          !data.lastReviewed ||
          sourceUrls.length !== (data.sources?.length ?? 0) ||
          sourceUrls.some(url => !data.sources?.includes(url))
        ) {
          context.addIssue({
            code: "custom",
            message:
              "Published trend bundles require a reviewed AI-assisted post and matching sources",
          });
        }
      })
      .transform(data => ({
        ...data,
        // Existing AI-Bot entries predate this field. Infer only that known
        // marker; every other post remains explicitly unverified by default.
        aiAssisted: data.aiAssisted ?? /^ai[- ]?bot$/i.test(data.author.trim()),
        sources: data.sources ?? [],
      })),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
