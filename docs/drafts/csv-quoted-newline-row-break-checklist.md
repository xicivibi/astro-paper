# 서명 전 확인 목록: CSV 메모 칸의 줄바꿈 때문에 5행이 7행으로 늘어날 때

- 글: `src/content/posts/csv-quoted-newline-row-break.md` (15분 이내)

## 1. 실행

- [ ] `lab/excel/cases/csv-quoted-newline-row-break/run.ps1`을 실행하거나, `source.csv`를 `query.m`(기본)과 `none.m`(QuoteStyle.None)으로 읽어 행 수를 비교합니다.
- [ ] 결과 파일: 같은 폴더의 `result.json`.

## 2. 비교할 숫자 (Excel 16.0 빌드 20527 기준)

- [ ] 기본 Csv.Document: 5행
- [ ] `QuoteStyle.None`: 7행 (S1, S4가 각각 2행으로 쪼개짐)
- [ ] Excel에서 CSV 직접 열기: 5행
- [ ] 쪼개진 행의 ID 칸에 `second"`, `fourth"`

## 3. 글에 쓴 UI 경로

- [ ] 가져오기 대화 상자의 **Line breaks** 항목(`Ignore quoted line breaks` / `Apply all line breaks`)은 Text/CSV 커넥터 문서의 영어 표기를 그대로 적었습니다. 한국어 UI의 항목 이름과 어느 값이 `QuoteStyle.None`이 되는지 확인합니다.

## 4. 독자가 오해할 수 있는 점 (not_verified)

- [ ] 기본 설정에서는 행이 쪼개지지 않았습니다. 글이 이를 먼저 밝히는지 확인합니다.
- [ ] `QuoteStyle.Csv`를 명시한 실행은 하지 않았다고 적혀 있는지 확인합니다.
- [ ] CRLF 줄바꿈 파일만 관측했습니다.

## 5. 마무리

- [ ] 직접 따라 한 뒤 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다.
- [ ] 직접 겪은 경험이 있으면 한 문장만, 없으면 쓰지 않습니다.
