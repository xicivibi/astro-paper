# 소유자 서명 체크리스트: 형식 변환 오류 행 (power-query-type-change-error-rows)

글: `src/content/posts/power-query-type-change-error-rows.md` (draft). 15분 안에 끝내는 확인 목록입니다.

## 1. 실행

- [ ] `lab/excel/cases/power-query-type-change-error-rows/run.ps1`을 실행하거나, `input.xlsx`의 `Input` 표(모두 텍스트)에서 `query.m`, `keep_errors.m`, `replace_errors.m`, `diagnostics.m`, `fixed.m`을 수동으로 만들어 봅니다.

## 2. 비교할 관찰값 (result.json)

- [ ] 형식 변환 쿼리 로드: 6행, `Amount`는 10 / 빈 셀 / 0 / 빈 셀 / 빈 셀 / 25, 로드된 오류 셀 0개
- [ ] `Code`가 정수일 때 `101`, 텍스트일 때 `00101`
- [ ] `HasError`: `00102`(bad), `00105`(12x)만 TRUE, 빈 셀 `00104`는 FALSE
- [ ] Keep errors에 해당하는 `Table.SelectRowsWithErrors`: 2행(102, 105)
- [ ] 오류 대체 후 정상 숫자 합계 35

## 3. 글에 쓴 UI 경로와 이름 (확인 필요)

- [ ] 글은 Keep errors / Replace errors 기능 이름만 언급하고 메뉴 경로는 쓰지 않았습니다. Microsoft 문서(dealing-with-errors)의 경로는 Home > Reduce rows > Keep rows > Keep errors, Transform > Any column > Replace values > Replace errors 입니다. 한국어 메뉴 이름을 확인합니다.

## 4. 독자가 오해할 수 있는 미검증 사항

- 이번 시험에서 기대와 다르게 오류 셀이 시트에 나타나지 않았습니다(`differences_from_brief`에 기록). 다른 로드 방식(데이터 모델 등)에서도 같은지는 모릅니다. 글에는 이 빌드와 표본의 관찰값으로만 적었습니다.
- 오류를 null로 바꾼 뒤 후속 계산 단계, 다른 빌드/로캘, 사람이 직접 클릭한 경로는 검증하지 않았습니다.

## 5. 마지막 단계

- [ ] `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다(직접 확인한 뒤에만).
- [ ] 직접 겪은 경험이 있다면 한 문장만 정직하게 씁니다. 없으면 쓰지 않습니다.
- [ ] 표본 데이터 키트 링크를 붙입니다.
