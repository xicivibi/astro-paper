# 소유자 서명 체크리스트: 그룹 합계 (power-query-group-by-subtotal)

글: `src/content/posts/power-query-group-by-subtotal.md` (draft). 15분 안에 끝내는 확인 목록입니다.

## 1. 실행

- [ ] `lab/excel/cases/power-query-group-by-subtotal/run.ps1`을 실행하거나, `input.xlsx`의 `Input` 표(B5는 텍스트 `20`)에서 `query.m`, `errors.m`, `fixed.m`을 수동으로 만들어 봅니다.

## 2. 비교할 관찰값 (result.json)

- [ ] 원본 Excel `SUM` = 15 (텍스트 `20`은 더해지지 않음)
- [ ] 형식 미지정 그룹화: A 합계 10 / B 합계 빈 셀 / C 합계 0, 행 수는 3·2·2, NonNulls는 2·2·1
- [ ] `errors.m`: B 그룹만 `HasError` = TRUE
- [ ] 숫자 형식 지정 후: A 10, B 25, C 0 (합계의 합 35, 차이 20)
- [ ] 행 수 합 7, NonNulls 합 5

## 3. 글에 쓴 UI 경로와 이름 (확인 필요)

- [ ] 글은 "그룹화" 기능 이름만 쓰고 메뉴 경로는 쓰지 않습니다. 한국어 Excel에서 실제 메뉴 이름이 "그룹화"인지 확인합니다.

## 4. 독자가 오해할 수 있는 미검증 사항

- B 그룹 `Sum`이 빈 셀로 읽힌 이유(오류 셀로 로드되지 않음)는 설명하지 못했습니다. 글도 관찰값으로만 적었습니다.
- 텍스트 `12x` 같은 변환 불가 값, 다른 culture, 다른 빌드/로캘, 사람이 직접 클릭한 경로는 검증하지 않았습니다.

## 5. 마지막 단계

- [ ] `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다(직접 확인한 뒤에만).
- [ ] 직접 겪은 경험이 있다면 한 문장만 정직하게 씁니다. 없으면 쓰지 않습니다.
- [ ] 표본 데이터 키트 링크를 붙입니다.
