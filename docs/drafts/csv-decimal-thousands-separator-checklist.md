# 서명 전 확인 목록: CSV 숫자 1.234가 1.234일까 1234일까

- 글: `src/content/posts/csv-decimal-thousands-separator.md` (15분 이내)

## 1. 실행

- [ ] `lab/excel/cases/csv-decimal-thousands-separator/run.ps1`을 실행하거나, `source.csv`를 읽어 `us.m`, `de.m`, `fixed.m`을 차례로 적용합니다.
- [ ] 결과 파일: 같은 폴더의 `result.json`.

## 2. 비교할 숫자 (Excel 16.0 빌드 20527 기준)

- [ ] en-US로 읽기: S1 오류, S3 1.234, S5 123456
- [ ] de-DE로 읽기: S2 오류, S4 1.234, S6 123456
- [ ] 두 합계: 127160.35399999999 (en-US), 127160.354 (de-DE)
- [ ] 행별 로캘 적용 합계 7406.24, 6행 모두 의도한 값
- [ ] 두 해석의 배율: 1000배 2행, 100배 2행

## 3. 글에 쓴 UI 경로

- 본문에 리본 클릭 경로는 쓰지 않았습니다. 확인할 UI 경로 없음.

## 4. 독자가 오해할 수 있는 점 (not_verified)

- [ ] 합계가 같게 나온 것은 이 표본 구성의 결과입니다. 일반 현상처럼 읽히지 않는지 확인합니다.
- [ ] 행별 로캘 방식은 `SourceLocale` 열이 있을 때만 쓸 수 있다고 적혀 있는지 확인합니다.
- [ ] 한 파일 안에서 섞인 표기를 값만으로 가르는 방법, Excel 직접 열기는 시험하지 않았습니다.

## 5. 마무리

- [ ] 직접 따라 한 뒤 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다.
- [ ] 직접 겪은 경험이 있으면 한 문장만, 없으면 쓰지 않습니다.
