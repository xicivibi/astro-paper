export const excelCsvJourney = [
  {
    step: "1",
    title: "가져오기 진단",
    description: "한글 깨짐, 구분자, 따옴표와 열 구조부터 확인합니다.",
    postIds: ["csv-korean-encoding-delimiter-checklist"],
    toolHref: "/tools/csv-preview/",
    toolLabel: "CSV 파일 점검",
  },
  {
    step: "2",
    title: "식별자 보존",
    description: "선행 0과 긴 숫자를 계산값이 아닌 텍스트 식별자로 지킵니다.",
    postIds: ["excel-leading-zeros-large-identifiers-power-query"],
    toolHref: "/tools/identifier-check/",
    toolLabel: "식별자 점검",
  },
  {
    step: "3",
    title: "여러 파일 결합",
    description: "폴더 결합 전에 헤더와 열 순서가 달라지는 지점을 확인합니다.",
    postIds: ["power-query-folder-combine-header-column-order"],
    toolHref: "/tools/header-compare/",
    toolLabel: "열 이름 비교",
  },
  {
    step: "4",
    title: "값 정리",
    description:
      "중복 기준과 날짜 로캘을 명시해 새로고침 결과를 설명 가능하게 만듭니다.",
    postIds: [
      "power-query-remove-duplicates-key-normalization",
      "power-query-csv-date-using-locale",
    ],
  },
  {
    step: "5",
    title: "두 목록 비교",
    description:
      "정규화 규칙을 먼저 정한 뒤 Left Anti로 한쪽에만 있는 값을 찾습니다.",
    postIds: ["power-query-left-anti-compare-lists"],
    toolHref: "/tools/list-compare/",
    toolLabel: "두 목록 비교",
  },
] as const;
