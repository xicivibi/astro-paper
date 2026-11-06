# 서명 체크리스트: 조회 키 중복과 VLOOKUP·XLOOKUP (excel-duplicate-key-before-vlookup)

글: `src/content/posts/excel-duplicate-key-before-vlookup.md` (draft). 15분 안에 끝내는 목록입니다.

## 1. 열어서 실행

- `lab/excel/cases/excel-duplicate-key-before-vlookup/run.ps1`을 실행하거나 `input.xlsx`를 엽니다. Power Query 확인용 코드는 같은 폴더 `query.m`입니다.
- 표본: 주문 5행(키 A~E), 단가표 6행(키 B가 20과 200으로 두 번), 승인표 5행(B=200).

## 2. 대조할 숫자 (result.json 기준)

- 키 B: `VLOOKUP` = 20, `XLOOKUP`(기본) = 20, `COUNTIF` = 2
- 금액(수량 x 첫 일치 단가) = 10, 40, 90, 40, 100, 합계 280
- 승인 단가 기준 금액 = 10, 400, 90, 40, 100, 합계 640, 차이 360
- Power Query 중복 키 쿼리 결과 1행: B, 개수 2, 최솟값 20, 최댓값 200

## 3. 본문에 언급한 메뉴 경로

- 없음. 함수와 M 코드만 적었음.

## 4. 독자가 오해할 수 있는 미확인 항목

- `XLOOKUP`의 검색 방향 변경(마지막부터)은 문서만 언급, 실행 안 함
- 단가표 정렬을 바꿨을 때 결과가 달라지는지 미시험
- 승인 단가 200은 표본에서 정한 값이며 업무상 정답이 아님(본문에 명시)

## 5. 마지막 단계

- `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 직접 채웁니다.
- 실제로 겪은 경험이 있으면 정직한 한 문장을 직접 추가합니다. 없으면 추가하지 않습니다.
- 표본 데이터 키트 링크는 서명 후에 붙입니다.
