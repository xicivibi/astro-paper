import type { CollectionEntry } from "astro:content";
import type { TopicDefinition } from "@/config/topics";

type Post = CollectionEntry<"posts">;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

export function postMatchesTopic(post: Post, topic: TopicDefinition) {
  const allowedTags = new Set(topic.tags.map(normalize));
  return (post.data.tags ?? []).some(tag => allowedTags.has(normalize(tag)));
}

export function getTopicPosts(posts: Post[], topic: TopicDefinition) {
  return posts.filter(
    post => !post.data.draft && postMatchesTopic(post, topic)
  );
}
