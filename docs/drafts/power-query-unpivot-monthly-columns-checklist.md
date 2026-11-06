# 소유자 서명 체크리스트: 월 열 피벗 해제 (power-query-unpivot-monthly-columns)

글: `src/content/posts/power-query-unpivot-monthly-columns.md` (draft). 15분 안에 끝내는 확인 목록입니다.

## 1. 실행

- [ ] `lab/excel/cases/power-query-unpivot-monthly-columns/run.ps1`을 실행하거나, `input.xlsx`의 `Input` 표에서 `query.m`(Unpivot Other Columns)과 `selected.m`(열 직접 선택)을 수동으로 만들어 봅니다.
- [ ] `2027-01` 열(S1~S6에 101~106)을 추가하고 새로 고침합니다.

## 2. 비교할 관찰값 (result.json)

- [ ] 12개월: 두 방식 모두 58행, `Amount` 합계 2407, 원본 SUM 2407
- [ ] `2027-01` 추가 후 열 직접 선택: 58행, 합계 2407 (원본 SUM 3028)
- [ ] `2027-01` 추가 후 나머지 열 피벗 해제: 64행, 합계 3028
- [ ] 빠진 금액 621(= 101+102+103+104+105+106)
- [ ] 입력의 빈 셀 14개는 결과에 행으로 나오지 않음(숫자 셀 58개 -> 64개)

## 3. 글에 쓴 UI 경로와 이름 (확인 필요)

- [ ] 글은 메뉴 클릭 경로를 쓰지 않고 기능 이름만 영어로 씁니다: Unpivot Columns / Unpivot Other Columns / Unpivot Only Selected Columns (Microsoft 문서 표기). 한국어 Excel에서 실제 메뉴 이름을 확인해 필요하면 글에 한국어 이름을 덧붙입니다.

## 4. 독자가 오해할 수 있는 미검증 사항

- 는 만들지 못했습니다(PNG 생성 실패 기록).
- 빈 셀을 0으로 채우거나 빈 월 행을 남기는 방법은 시험하지 않았습니다. 글도 그렇게 적었습니다.
- 다른 Excel 빌드, 다른 로캘, 사람이 직접 클릭한 경로는 검증하지 않았습니다.

## 5. 마지막 단계

- [ ] 본문 앞머리에 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다(직접 확인한 뒤에만).
- [ ] 직접 겪은 경험이 있다면 한 문장만 정직하게 씁니다. 없으면 쓰지 않습니다.
- [ ] 표본 데이터 키트 링크를 붙입니다.
