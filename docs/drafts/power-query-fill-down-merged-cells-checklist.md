# 소유자 서명 체크리스트: 병합 셀 아래로 채우기 (power-query-fill-down-merged-cells)

글: `src/content/posts/power-query-fill-down-merged-cells.md` (draft). 15분 안에 끝내는 확인 목록입니다.

## 1. 실행

- [ ] `lab/excel/cases/power-query-fill-down-merged-cells/run.ps1`을 실행하거나, `input.xlsx`(A2:A3, A4:A5, A6:A7 병합)를 `query.m`, `fill.m`, `empty_string.m`, `fixed.m`으로 수동 확인합니다.

## 2. 비교할 관찰값 (result.json)

- [ ] 읽은 직후 `Group`이 null인 행 3개(병합의 아래 칸)
- [ ] `FillDown(Group, Note)`: `Group`은 모두 채워짐, `Note`의 S4는 빈 문자열
- [ ] 시험 열 `LiteralEmpty`: 채운 뒤 S3~S6 4행이 빈 문자열(`IsEmptyString` TRUE 4개)
- [ ] 빈 문자열을 null로 바꾼 뒤 채우기: 6행 모두 `Seed`, 행 수 6 유지
- [ ] `S3`의 `Note`를 xlsx에서 읽은 값은 `''`(빈 문자열)

## 3. 글에 쓴 UI 경로와 이름 (확인 필요)

- [ ] "아래로 채우기" 기능. Microsoft 문서(fill-values-column)는 열을 오른쪽 클릭한 뒤 Fill > Down 이라고 설명합니다. 한국어 메뉴 이름을 확인합니다. 글에는 경로를 적지 않았습니다.

## 4. 독자가 오해할 수 있는 미검증 사항

- `S3`의 빈 문자열이 어떻게 만들어졌는지(수식 결과인지 직접 입력인지)는 글에 쓰지 않았습니다. 필요하면 `procedures.ps1`로 확인합니다.
- `LiteralEmpty`는 M에서 만든 시험 열입니다. 외부 CSV에서 빈 칸이 null로 읽히는지 빈 문자열인지는 검증하지 않았습니다.
- 다른 빌드/로캘, 사람이 직접 클릭한 경로는 검증하지 않았습니다.

## 5. 마지막 단계

- [ ] `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다(직접 확인한 뒤에만).
- [ ] 직접 겪은 경험이 있다면 한 문장만 정직하게 씁니다. 없으면 쓰지 않습니다.
- [ ] 표본 데이터 키트 링크를 붙입니다.
