export type TopicDefinition = {
  slug: string;
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
    intro: "Excel과 CSV 파일을 다루는 실무 기록을 모읍니다.",
    tags: ["excel", "엑셀", "csv"],
    emptyState: "아직 Excel·CSV 주제로 분류된 공개 글이 없습니다.",
  },
  {
    slug: "google-sheets-apps-script",
    title: "Google Sheets·Apps Script",
    intro: "Google Sheets와 Apps Script 자동화 기록을 모읍니다.",
    tags: ["google sheets", "apps script", "google apps script"],
    emptyState:
      "아직 Google Sheets·Apps Script 주제로 분류된 공개 글이 없습니다.",
  },
  {
    slug: "docs-web-work",
    title: "문서·웹 업무",
    intro: "문서 작성과 웹 업무를 다시 따라 할 수 있게 정리한 기록을 모읍니다.",
    tags: ["문서", "문서 업무", "웹 업무", "docs", "web work"],
    emptyState: "아직 문서·웹 업무 주제로 분류된 공개 글이 없습니다.",
  },
];

export function getTopic(slug: string) {
  return topics.find(topic => topic.slug === slug);
}
