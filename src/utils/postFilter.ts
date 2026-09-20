import type { CollectionEntry } from "astro:content";
import config from "@/config";

type PostData = CollectionEntry<"posts">["data"];

/** AI-assisted content stays private until its review metadata is complete. */
export function hasRequiredAiEvidence(data: PostData) {
  return (
    !data.aiAssisted ||
    (Boolean(data.lastReviewed) &&
      data.sources.length > 0 &&
      data.testingStatus !== "not_tested")
  );
}

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - Excludes drafts always
 * - Excludes posts under editorial hold from public discovery surfaces
 * - In production, excludes scheduled posts until `pubDatetime` minus the configured margin
 * - In dev, always shows non-draft posts to make authoring easier
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  return (
    !data.draft &&
    data.editorialStatus !== "legacy_hold" &&
    hasRequiredAiEvidence(data) &&
    (import.meta.env.DEV || isPublishTimePassed)
  );
}

/** Keeps an existing URL renderable while its post is under editorial hold. */
export function routablePostFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  return (
    !data.draft &&
    (data.editorialStatus === "legacy_hold" || hasRequiredAiEvidence(data)) &&
    (import.meta.env.DEV || isPublishTimePassed)
  );
}
