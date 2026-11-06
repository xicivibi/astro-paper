# 소유자 서명 체크리스트: 구분자 열 분할 (power-query-split-column-delimiter)

글: `src/content/posts/power-query-split-column-delimiter.md` (draft). 15분 안에 끝내는 확인 목록입니다.

## 1. 실행

- [ ] `lab/excel/cases/power-query-split-column-delimiter/run.ps1`을 실행하거나, `input.xlsx`의 `Input` 표에서 `query.m`, `strict.m`, `dynamic.m`을 수동으로 만들어 봅니다.
- [ ] 표 끝에 `S6`, `N|O|P|Q`를 추가하고 새로 고침합니다.

## 2. 비교할 관찰값 (result.json)

- [ ] 처음 5행 고정 분할: `ID`, `P1`~`P3`의 4열. `S4`의 `P2`는 `H, I`
- [ ] `S2`의 `P3`, `S3`의 `P2`/`P3`은 null, `S5`의 `P2`는 빈 문자열
- [ ] `S6` 추가 후 기본 분할: 6행, 여전히 4열, `Q`가 결과에 없음
- [ ] `ExtraValues.Error` 분할: `S6`의 `P1`~`P3`이 모두 빈 셀
- [ ] 조각 수로 열 수를 계산한 분할: 5열(`P4`에 `Q`)

## 3. 글에 쓴 UI 경로와 이름 (확인 필요)

- [ ] 글은 메뉴 경로를 쓰지 않고 M 함수 이름(`Table.SplitColumn`, `Splitter.SplitTextByDelimiter`, `ExtraValues.Error`)만 씁니다. 별도로 확인할 UI 경로는 없습니다.

## 4. 독자가 오해할 수 있는 미검증 사항

- `ExtraValues.Error` 사용 시 `S6` 행이 빈 칸이 된 이유가 오류 때문인지는 확인하지 못했습니다(오류 셀은 감지되지 않음). 글도 그렇게 적었습니다.
- 4조각까지만 확인했습니다. 따옴표가 있는 값, 공백, 대용량 데이터는 시험하지 않았습니다.
- 다른 빌드/로캘, 사람이 직접 클릭한 경로는 검증하지 않았습니다.

## 5. 마지막 단계

- [ ] `humanReviewedBy`, `humanReviewedAt`, `testingStatus`를 채웁니다(직접 확인한 뒤에만).
- [ ] 직접 겪은 경험이 있다면 한 문장만 정직하게 씁니다. 없으면 쓰지 않습니다.
- [ ] 표본 데이터 키트 링크를 붙입니다.
