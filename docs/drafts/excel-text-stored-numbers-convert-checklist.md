# 서명 체크리스트: 텍스트 숫자 합계가 0이 될 때 (excel-text-stored-numbers-convert)

글: `src/content/posts/excel-text-stored-numbers-convert.md` (draft). 15분 안에 끝내는 목록입니다.

## 1. 열어서 실행

- `lab/excel/cases/excel-text-stored-numbers-convert/run.ps1`을 실행하거나, `input.xlsx`를 열어 직접 수식을 넣습니다. 정리용 M 코드는 같은 폴더의 `query.m`, `fixed.m`입니다.
- 표본: `Amount` 열 6행. S2는 앞뒤 일반 공백, S3는 앞뒤 비분리 공백(U+00A0), S4는 `1`과 `234` 사이 비분리 공백.

## 2. 대조할 숫자 (result.json 기준)

- 텍스트 원본 `SUM` = 0
- `VALUE`/`--` 결과: S3, S4만 `#VALUE!` (S1 10, S2 20, S5 0, S6 40)
- 정리 수식 `VALUE(SUBSTITUTE(TRIM(CLEAN(B2)),UNICHAR(160),""))` 합계 = 1334
- 형식만 바꾼 Power Query: S4가 빈 값(S3은 30), 정리 포함 쿼리는 1234까지 읽혀 합계 1334
- 텍스트 나누기(구분 기호, 일반) 후 합계 = 70 (S3, S4는 텍스트로 남음)

## 3. 본문에 언급한 메뉴 경로 (Microsoft 문서 기준, 직접 확인 필요)

- 셀 왼쪽 위 오류 표시에서 `숫자로 변환`(문서 영문: Convert to Number) 선택
- 텍스트 나누기: 본문에는 기능 이름만 적었음(구분 기호 방식, 열 서식 `일반`). 한국어 메뉴 이름이 맞는지 확인

## 4. 독자가 오해할 수 있는 미확인 항목

- 이 표본에서 녹색 삼각형이 실제로 뜨는지 미확인
- 다른 Excel 빌드, 다른 OS 언어에서의 동작 미확인
- 형식만 바꾼 Power Query에서 S4가 빈 값이 된 이유(오류 행이 아니라 빈 값으로 로드됨)는 기록만 했고 원인 설명은 하지 않았음

## 5. 마지막 단계

- `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 직접 채웁니다.
- 실제로 겪은 경험이 있으면 정직한 한 문장을 본문에 직접 추가합니다. 없으면 추가하지 않습니다.
- 표본 데이터 키트 링크는 서명 후에 붙입니다.
