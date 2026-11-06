# 서명 체크리스트: 인쇄 영역별 PDF 페이지 수 (excel-pdf-export-print-area-check)

글: `src/content/posts/excel-pdf-export-print-area-check.md` (draft). 15분 안에 끝내는 목록입니다.

## 1. 열어서 실행

- `lab/excel/cases/excel-pdf-export-print-area-check/run.ps1`을 실행하거나 `input.xlsx`로 수동 재현합니다.
- 설정: 18열 x (머리글+6행) = `A1:R7`, 열 너비 18, A4 세로, 배율 100%. 같은 폴더에 `with-print-area.pdf`, `without-print-area.pdf`, `fit-one-page-wide.pdf`가 있습니다.

## 2. 대조할 숫자 (result.json 기준)

- 인쇄 영역 `A1:F7`, 100%: PDF 2쪽, 세로 나누기 1개
- 인쇄 영역 없음, 100%: 5쪽, 세로 나누기 4개
- `A1:R7`, `Zoom=False`, `FitToPagesWide=1`, `FitToPagesTall=False`: 1쪽, 0개
- 가로 페이지 나누기는 세 경우 모두 0개

## 3. 본문에 언급한 메뉴 경로 (Microsoft 문서 기준, 직접 확인 필요)

- `페이지 레이아웃` 탭 > `크기 조정`(Scale to Fit) 그룹 > 너비 `1페이지`, 높이 `자동`
- `보기` 탭 > `페이지 나누기 미리 보기`
- 한국어 UI에서 위 이름이 실제 표기와 같은지 확인

## 4. 독자가 오해할 수 있는 미확인 항목

- 실제 프린터 출력, PDF 글자 추출, 1쪽에 맞춘 결과의 글자 크기와 가독성 미확인
- `A1:F7`만 지정해도 2쪽이 된 것은 이 열 너비·용지 조건의 결과임
- 열 분할은 Excel 페이지 나누기 개수와 PDF 페이지 개체 수로만 판단

## 5. 마지막 단계

- `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 직접 채웁니다.
- 실제로 겪은 경험이 있으면 정직한 한 문장을 직접 추가합니다. 없으면 추가하지 않습니다.
- 표본 데이터 키트 링크는 서명 후에 붙입니다.
