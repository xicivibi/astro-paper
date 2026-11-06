/** Hub slugs double as the `topic` enum in post frontmatter. */
export const topicSlugs = [
  "excel-csv",
  "google-sheets-apps-script",
  "docs-web-work",
] as const;
export type TopicSlug = (typeof topicSlugs)[number];

/**
 * Backlog clusters map onto the three hubs. Power Query belongs to the
 * Excel·CSV hub because every current Power Query guide starts from a file.
 */
export const backlogClusterTopics: Readonly<Record<string, TopicSlug>> = {
  "Excel CSV": "excel-csv",
  "Power Query": "excel-csv",
  "Sheets Forms": "google-sheets-apps-script",
  "업무 자동화 선택": "docs-web-work",
};

export type TopicDefinition = {
  slug: TopicSlug;
  title: string;
  intro: string;
  tags: string[];
  emptyState: string;
};

/** Explicit tag mappings keep a topic hub from silently broadening its scope. */
export const topics: TopicDefinition[] = [
  {
    slug: "excel-csv",
    title: "Excel·CSV",
    intro:
      "CSV 가져오기, 식별자 보존, Power Query 결합·정리·비교처럼 Excel 파일 작업에서 결과가 달라지는 지점을 다룹니다.",
    tags: ["excel", "엑셀", "csv", "power query"],
    emptyState: "아직 Excel·CSV 주제로 분류된 공개 글이 없습니다.",
  },
  {
    slug: "google-sheets-apps-script",
    title: "Google Sheets·Apps Script",
    intro:
      "Google Sheets 함수, 설문 응답 정리, Apps Script 자동화를 재현 가능한 절차로 정리합니다.",
    tags: ["google sheets", "apps script", "google apps script"],
    emptyState:
      "아직 Google Sheets·Apps Script 주제로 분류된 공개 글이 없습니다.",
  },
  {
    slug: "docs-web-work",
    title: "문서·웹 업무",
    intro: "업무 문서와 웹 도구를 고르고 연결할 때 확인할 기준을 정리합니다.",
    tags: ["문서", "문서 업무", "웹 업무", "docs", "web work"],
    emptyState: "아직 문서·웹 업무 주제로 분류된 공개 글이 없습니다.",
  },
];

export function getTopic(slug: string) {
  return topics.find(topic => topic.slug === slug);
}
