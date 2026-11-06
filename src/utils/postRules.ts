import { topicSlugs, type TopicSlug } from "../config/topics.ts";

type TopicFields = { draft?: boolean; topic?: string | null };

/**
 * Public posts must name exactly one hub. Drafts (including the bundled
 * AstroPaper examples) stay exempt so `astro check` keeps passing.
 */
export function topicIssue(data: TopicFields): string | null {
  if (data.topic && !topicSlugs.includes(data.topic as TopicSlug)) {
    return `topic must be one of ${topicSlugs.join(", ")}`;
  }
  if (data.draft !== true && !data.topic) {
    return "Published posts require a topic hub (excel-csv, google-sheets-apps-script, docs-web-work)";
  }
  return null;
}
