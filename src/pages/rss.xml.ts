import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import config from "@/config";
import { getPostUrl } from "@/utils/getPostPaths";
import { getSortedPosts } from "@/utils/getSortedPosts";

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  const siteUrl = site ?? new URL(config.site.url);

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: siteUrl,
    items: getSortedPosts(posts).map(post => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDatetime,
      link: new URL(
        getPostUrl(post.id, post.filePath, config.site.lang),
        siteUrl
      ).href,
    })),
    customData: `<language>${config.site.lang}</language>`,
  });
};
