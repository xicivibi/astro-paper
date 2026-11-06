# 서명 체크리스트: CSV 내보내기 전 개인정보 열 점검 (csv-export-personal-data-column-check)

글: `src/content/posts/csv-export-personal-data-column-check.md` (draft). 15분 안에 끝내는 목록입니다.

## 1. 열어서 실행

- `lab/excel/cases/csv-export-personal-data-column-check/run.ps1`을 실행하거나 `input.xlsx`로 수동 재현합니다. 결과 파일은 같은 폴더의 `full-export.csv`, `allowlist-export.csv`입니다.
- 순서: `B:D` 열 숨김, 표식 시트(`INVENTED_HIDDEN_SHEET_ONLY`) 숨김, `Input` 활성 상태에서 CSV UTF-8 저장 → 허용 열(`ID`, `Amount`)만 새 시트에 값으로 옮겨 활성으로 두고 다시 저장.

## 2. 대조할 숫자 (result.json 기준)

- 숨긴 열 상태 CSV: 5열, 5행, 숨긴 열 값 포함 = True, 숨김 시트 표식 포함 = False
- 허용 열 CSV: 2열, 5행, 합성 이메일 포함 = 없음
- `Amount` 합계: 양쪽 모두 150

## 3. 본문에 언급한 메뉴 경로

- 없음. 열 숨기기와 CSV UTF-8 저장은 기능 이름과 파일 형식 이름(`xlCSVUTF8`)만 적었음. Microsoft 문서의 "활성 시트만 저장" 설명을 인용함.

## 4. 독자가 오해할 수 있는 미확인 항목

- 숨긴 행의 저장 동작, 숨김 시트를 활성으로 두고 저장하는 경우 미시험
- 다른 CSV 형식(쉼표 구분 비UTF-8 등) 미확인
- 허용 목록 방식은 개인정보 보호 요건 충족 보증이 아님(본문에 명시)

## 5. 마지막 단계

- `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 직접 채웁니다.
- 실제로 겪은 경험이 있으면 정직한 한 문장을 직접 추가합니다. 없으면 추가하지 않습니다.
- 표본 데이터 키트 링크는 서명 후에 붙입니다.
