import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";

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
        tags: z.array(z.string()).default(["others"]),
        ogImage: image().or(z.string()).optional(),
        description: z.string(),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().optional(),
        aiAssisted: z.boolean().optional(),
        lastReviewed: z.date().optional().nullable(),
        sources: z
          .array(httpUrl)
          .max(8)
          .optional(),
        testingStatus: z
          .enum(["not_tested", "reproduced", "official_source_only"])
          .default("not_tested"),
        correctionNote: z.string().optional(),
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
