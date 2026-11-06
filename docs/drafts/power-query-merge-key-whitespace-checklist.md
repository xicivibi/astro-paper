# 서명 전 확인 목록: Power Query 병합에서 7행 중 2행만 맞을 때

- 글: `src/content/posts/power-query-merge-key-whitespace.md` (15분 이내)

## 1. 실행

- [ ] `lab/excel/cases/power-query-merge-key-whitespace/run.ps1`을 실행하거나, `input.xlsx`를 열고 `query.m`, `trim.m`, `fixed.m`을 같은 순서로 쿼리에 붙여 새로 고칩니다.
- [ ] 결과 파일: 같은 폴더의 `result.json`.

## 2. 비교할 숫자 (Excel 16.0 빌드 20527 기준)

- [ ] 정리 없이 병합: 일치 2행 (S1, S7)
- [ ] `Text.Trim`만: 일치 4행 (S2, S3 추가)
- [ ] Trim + Clean + U+00A0 치환: 일치 5행 (S6 추가)
- [ ] 끝까지 불일치: S4(전각), S5(소문자)
- [ ] 정리 전후 행 수 7

## 3. 글에 쓴 UI 경로

- 글 본문에 리본 클릭 경로는 쓰지 않았습니다. 확인할 UI 경로 없음.

## 4. 독자가 오해할 수 있는 점 (not_verified)

- [ ] `Text.Trim`이 U+00A0을 제거한 것은 이 빌드의 관측입니다. 다른 빌드에서 `Text.Replace` 단계가 필요한지 글에 "이 빌드에서"라고 적혀 있는지 확인합니다.
- [ ] 대소문자·전각 문자 해결 방법은 시험하지 않았다고 적혀 있는지 확인합니다.

## 5. 마무리

- [ ] 직접 따라 한 뒤 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다.
- [ ] 직접 겪은 경험이 있으면 한 문장만, 없으면 쓰지 않습니다.
