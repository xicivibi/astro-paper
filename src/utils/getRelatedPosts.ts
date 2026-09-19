import type { CollectionEntry } from "astro:content";

type Post = CollectionEntry<"posts">;

/** Select published posts sharing tags with the current post. */
export function getRelatedPosts(
  posts: Post[],
  currentPost: Post,
  limit = 3
): Post[] {
  const currentTags = new Set(currentPost.data.tags ?? []);

  return posts
    .filter(
      post =>
        post.id !== currentPost.id &&
        !post.data.draft &&
        post.data.editorialStatus !== "legacy_hold"
    )
    .map(post => ({
      post,
      sharedTags: (post.data.tags ?? []).filter(tag => currentTags.has(tag))
        .length,
      updatedAt: new Date(
        post.data.modDatetime ?? post.data.pubDatetime
      ).getTime(),
    }))
    .filter(candidate => candidate.sharedTags > 0)
    .sort(
      (a, b) =>
        b.sharedTags - a.sharedTags ||
        b.updatedAt - a.updatedAt ||
        a.post.id.localeCompare(b.post.id)
    )
    .slice(0, Math.max(0, limit))
    .map(candidate => candidate.post);
}
