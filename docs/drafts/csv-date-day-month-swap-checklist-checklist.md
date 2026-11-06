# 서명 전 확인 목록: CSV의 03/04/2026이 로캘에 따라 3월 4일도 4월 3일도 될 때

- 글: `src/content/posts/csv-date-day-month-swap-checklist.md` (15분 이내)

## 1. 실행

- [ ] `lab/excel/cases/csv-date-day-month-swap-checklist/run.ps1`을 실행하거나, `source.csv`를 쿼리로 읽고 `us.m`, `gb.m`, `*_audit.m`을 차례로 적용합니다.
- [ ] 결과 파일: 같은 폴더의 `result.json`.

## 2. 비교할 숫자 (Excel 16.0 빌드 20527 기준)

- [ ] en-US 오류 2행 (S2, S5), en-GB 오류 1행 (S5)
- [ ] 두 로캘 모두 유효하지만 날짜가 다른 행 3개 (S1, S3, S4)
- [ ] S1: en-US 2026-03-04, en-GB 2026-04-03
- [ ] S4: en-US 2026-12-11, en-GB 2026-11-12
- [ ] 직접 열기: 6칸 모두 텍스트로 남음

## 3. 글에 쓴 UI 경로

- 본문에 리본 클릭 경로는 쓰지 않았습니다. 확인할 UI 경로 없음.

## 4. 독자가 오해할 수 있는 점 (not_verified)

- [ ] culture를 지정하지 않은 변환 결과는 실행하지 않았습니다. 글이 그렇게 적었는지 확인합니다.
- [ ] 직접 열기 결과는 이 컴퓨터의 지역 설정(날짜 순서 연-월-일)에서만 관측했습니다.
- [ ] "25/04가 일/월/연의 힌트"라는 설명은 추론이며 실험 결과가 아닙니다.

## 5. 마무리

- [ ] 직접 따라 한 뒤 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다.
- [ ] 직접 겪은 경험이 있으면 한 문장만, 없으면 쓰지 않습니다.
