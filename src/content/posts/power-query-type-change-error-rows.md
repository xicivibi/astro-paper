---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:04:43+09:00
title: "형식 변환 오류 행이 시트에서는 빈 칸으로만 보일 때 찾는 법"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "형식 변환"
  - "오류 행"
  - "excel"
  - "선행 0"
description: "숫자 변환 오류 2행이 오류 셀 없이 빈 칸으로 로드된 실험과, 오류 행을 따로 확인하고 코드의 선행 0을 지키는 M 코드를 정리합니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/power-query/dealing-with-errors"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-transformcolumntypes"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-selectrowswitherrors"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-replaceerrorvalues"
  - "https://learn.microsoft.com/en-us/powerquery-m/number-fromtext"
testingStatus: not_tested
---

Power Query에서 텍스트로 들어온 열의 형식을 숫자로 바꿀 때 `bad`나 `12x` 같은 값은 변환 오류가 됩니다. 문서에는 이런 값이 오류 칸으로 표시된다고 나와 있어서, 시트에 로드해도 오류 셀이 보일 것이라고 기대하기 쉽습니다. 이 글은 그 기대를 실제 Excel에서 확인해 본 결과를 정리합니다. 결과가 기대와 달랐기 때문에, 관찰된 그대로를 적습니다.

## 표본 데이터

6행짜리 표(이름 `Input`)이고, 두 열 모두 텍스트로 저장되어 있습니다. `Code`는 앞자리 0이 있는 코드입니다.

| Code | Amount | 비고 |
| --- | --- | --- |
| 00101 | 10 | 정상 |
| 00102 | bad | 숫자로 바꿀 수 없음 |
| 00103 | 0 | 정상(0) |
| 00104 | (빈 셀) | 값 없음 |
| 00105 | 12x | 숫자로 바꿀 수 없음 |
| 00106 | 25 | 정상 |

## 형식을 바꾼 쿼리의 결과

`Code`를 정수로, `Amount`를 숫자로 바꾸는 쿼리입니다.

```powerquery
Table.TransformColumnTypes(
    Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    {{"Code", Int64.Type}, {"Amount", type number}}, "en-US")
```

시트에 로드한 결과입니다.

| Code | Amount |
| --- | --- |
| 101 | 10 |
| 102 | (빈 셀) |
| 103 | 0 |
| 104 | (빈 셀) |
| 105 | (빈 셀) |
| 106 | 25 |

관찰된 것은 두 가지입니다.

1. `bad`와 `12x`의 변환 오류는 시트에서 오류 셀(`#VALUE!` 같은 값)이 아니라 빈 셀로 읽혔습니다. 로드된 오류 셀은 0개였습니다. 오류 셀이 나타날 것이라는 사전 기대와 다른 결과이며, 이 빌드와 이 표본에서 관찰된 값입니다. 결과 표만 보면 `00102`, `00105`의 빈 칸과 원래 비어 있던 `00104`를 구별할 수 없습니다.
2. `Code`가 정수로 바뀌면서 `00101`이 `101`이 되었습니다. 앞자리 0은 복구되지 않습니다. 코드 열의 형식 지정은 오류와 별개의 문제입니다.

## 오류 행을 따로 가려내는 방법

시트에서 구분이 안 되므로 쿼리 안에서 오류 행을 찾아야 합니다. 두 가지를 시험했습니다.

```powerquery
Table.SelectRowsWithErrors(query, {"Amount"})
```

`Table.SelectRowsWithErrors`는 문서대로 지정한 열에 오류가 있는 행만 돌려줍니다. 결과는 `102`와 `105` 두 행이었습니다. 이 기능은 문서에서 Keep errors로 소개하는 기능과 같은 방향입니다.

오류가 난 원인까지 보려면 원본 텍스트를 변환 시도하고 결과를 `try`로 받습니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    T = Table.AddColumn(S, "Attempt", each try Number.FromText([Amount], "en-US")),
    H = Table.AddColumn(T, "HasError", each [Attempt][HasError]),
    M = Table.AddColumn(H, "Message", each if [HasError] then [Attempt][Error][Message] else null)
in
    Table.RemoveColumns(M, {"Attempt"})
```

`HasError`는 `00102`(`bad`)와 `00105`(`12x`)에서 `TRUE`였고 나머지 4행은 `FALSE`였습니다. 빈 셀인 `00104`는 `FALSE`였습니다. 즉 값이 없는 행은 변환 오류가 아닙니다. 오류 메시지는 `Number로 변환할 수 없습니다.`였습니다.

## 오류를 빈 값으로 바꾸는 쿼리와 코드의 선행 0

`Table.ReplaceErrorValues`로 오류를 `null`로 바꾸는 쿼리도 같은 방식으로 시험했습니다.

```powerquery
Table.ReplaceErrorValues(query, {{"Amount", null}})
```

시트에 로드된 결과는 오류를 바꾸기 전과 육안으로 똑같았습니다(`102`, `104`, `105`의 `Amount`가 모두 빈 셀). 오류 셀이 로드되지 않았으므로 이 단계의 효과는 시트 값으로는 드러나지 않았습니다. 이 단계가 필요한 경우는 오류가 있는 열을 이후 단계에서 계산에 쓸 때일 텐데, 그런 후속 단계는 이 시험에서 확인하지 않았습니다.

코드의 앞자리 0은 열을 텍스트로 지정해서 지켰습니다.

```powerquery
Table.ReplaceErrorValues(
    Table.TransformColumnTypes(
        Excel.CurrentWorkbook(){[Name="Input"]}[Content],
        {{"Code", type text}, {"Amount", type number}}, "en-US"),
    {{"Amount", null}})
```

| Code | Amount |
| --- | --- |
| 00101 | 10 |
| 00102 | (빈 셀) |
| 00103 | 0 |
| 00104 | (빈 셀) |
| 00105 | (빈 셀) |
| 00106 | 25 |

행은 6행으로 유지되었고, `Code`는 `00101`~`00106`이 그대로였으며 `Amount` 합계는 `10 + 0 + 25 = 35`였습니다.

## 대조에 쓴 숫자

- 원본 행 수 6, 변환 후 행 수 6.
- 변환 오류 행 2(`00102`, `00105`). 값이 없는 행(`00104`)은 오류가 아닙니다.
- 정상 숫자 행의 합계 35(`10 + 0 + 25`).
- 숫자 코드 `101` 대 텍스트 코드 `00101`.

## 내 파일에 적용할 때 확인할 것

- [ ] 형식 변환 뒤 시트에 오류 셀이 없더라도 오류가 없다고 판단하지 않습니다. 빈 칸 수를 원본의 빈 칸 수와 비교합니다.
- [ ] 변환 전 열을 텍스트로 두고 `try Number.FromText(...)` 같은 진단 열로 `HasError`를 세어 봅니다.
- [ ] 오류 행을 지우거나 비우기 전에 `Table.SelectRowsWithErrors`로 어떤 행인지 목록을 따로 남깁니다.
- [ ] 상품 코드, 우편번호처럼 앞자리 0이 의미 있는 열은 숫자 형식을 지정하지 않습니다.
- [ ] 변환 전후 행 수가 같은지, 정상 값의 합계가 원본에서 직접 구한 값과 같은지 확인합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![숫자형 Code의 선행 0 소실과 Amount 빈 칸](/images/excel-lab/power-query-type-change-error-rows/before.png)

숫자형 Code의 선행 0 소실과 Amount 빈 칸.

![텍스트형 Code의 선행 0 보존과 Amount 빈 칸](/images/excel-lab/power-query-type-change-error-rows/after.png)

텍스트형 Code의 선행 0 보존과 Amount 빈 칸.

## 이 글에서 확인한 범위

- 환경: Windows의 데스크톱 Excel 16.0 빌드 20527, 한국어 UI(`ko-KR`)입니다.
- 데이터: 직접 만든 합성 데이터이며 이 글의 표본 데이터와 같은 값입니다. 실제 업무 데이터가 아닙니다.
- 실행 방식: 위 쿼리를 데스크톱 Excel에서 자동화 도구로 불러와 새로 고침하고 시트에 로드된 값을 읽었습니다. 사람이 메뉴를 하나씩 누른 기록이 아닙니다.
- 오류 셀이 로드되지 않고 빈 셀로 읽힌 것은 이 빌드와 이 표본에서 관찰된 값입니다. 다른 Excel 빌드나 로드 설정(예: 데이터 모델로 로드), 다른 로캘에서 같은지는 확인하지 않았습니다.
- 검증하지 못한 것: 리본 메뉴의 정확한 클릭 경로(Keep errors, Replace errors 메뉴 포함)는 확인하지 않았습니다. 기능 이름은 Microsoft 문서의 표기를 따랐습니다.
