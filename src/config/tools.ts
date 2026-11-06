/** Browser tools that process files locally; shown on the home and tools pages. */
export const browserTools = [
  {
    href: "/tools/csv-preview/",
    kicker: "CSV",
    title: "CSV 파일 점검",
    description:
      "인코딩 단서, 구분자, 열 구조와 수식 주의 셀을 저장 전에 확인합니다.",
  },
  {
    href: "/tools/identifier-check/",
    kicker: "EXCEL",
    title: "식별자 길이·선행 0 점검",
    description: "상품 코드·사번에서 선행 0과 15자리 초과 숫자를 찾습니다.",
  },
  {
    href: "/tools/list-compare/",
    kicker: "POWER QUERY",
    title: "두 목록 차이 비교",
    description:
      "공백·대소문자·중복 규칙을 정한 뒤 한쪽에만 있는 값을 찾습니다.",
  },
  {
    href: "/tools/header-compare/",
    kicker: "SCHEMA",
    title: "파일 열 이름 비교",
    description: "폴더 결합 전에 누락 열과 열 순서 차이를 확인합니다.",
  },
] as const;
