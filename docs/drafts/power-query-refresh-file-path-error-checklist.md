# 서명 전 확인 목록: 파일을 옮긴 뒤 Power Query 새로고침이 DataSource.NotFound로 멈출 때

- 글: `src/content/posts/power-query-refresh-file-path-error.md` (15분 이내)

## 1. 실행

- [ ] `lab/excel/cases/power-query-refresh-file-path-error/run.ps1`을 실행하거나, `before-file-move.xlsx`를 저장해 닫은 뒤 `source.csv`를 다른 이름으로 옮기고 다시 열어 새로 고칩니다.
- [ ] 결과 파일: 같은 폴더의 `result.json`. 직접 하면 Excel이 CSV를 잡고 있어 이름 바꾸기가 막힐 수 있으니 Excel을 완전히 종료한 뒤 옮깁니다.

## 2. 비교할 숫자

- [ ] 처음 읽기: 5행 (S1~S5, Amount 10~50, 텍스트)
- [ ] 옮긴 뒤 새로고침 오류: `[DataSource.NotFound]` ... `파일을 찾을 수 없습니다.`
- [ ] 진단 쿼리: Reason `DataSource.NotFound`, Detail은 찾지 못한 경로
- [ ] 이름 정의 셀 `SourcePath` 적용 뒤: 5행

## 3. 글에 쓴 UI 경로

- [ ] 셀에 이름을 붙이는 기능(이름 정의), 새로 고침. 클릭 경로는 본문에 쓰지 않았고 기능 이름만 있습니다.
- [ ] 단일 셀 이름 정의가 `Column1` 한 열짜리 표로 읽히는지.

## 4. 독자가 오해할 수 있는 점 (not_verified)

- [ ] 오류 메시지의 한국어 문구는 ko-KR 환경 관측입니다.
- [ ] 네트워크 폴더·SharePoint 경로, 대화 상자로 경로를 바꾸는 방법은 시험하지 않았습니다.
- [ ] Excel 실행 중 이름 바꾸기가 막혔다는 서술이 본문에 맞는지 확인합니다.

## 5. 마무리

- [ ] 직접 따라 한 뒤 `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다.
- [ ] 직접 겪은 경험이 있으면 한 문장만, 없으면 쓰지 않습니다.
