---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T22:57:59+09:00
title: "텍스트로 저장된 숫자가 Power Query 그룹 합계를 비워 버릴 때"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "그룹화"
  - "합계 검증"
  - "excel"
  - "데이터 형식"
description: "텍스트 숫자 한 칸 때문에 그룹 합계가 빈 셀이 되는 사례와, 숫자 형식 지정 후 합계 35가 행 수 7·숫자 개수 5와 맞는지 대조하는 방법을 보여 줍니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/power-query/group-by"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-group"
  - "https://learn.microsoft.com/en-us/powerquery-m/list-sum"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-transformcolumntypes"
testingStatus: not_tested
---

Power Query의 그룹화로 그룹별 합계를 만들었는데 한 그룹의 합계 칸만 비어 있다면, 금액 열 안에 숫자가 아닌 값이 섞여 있을 가능성이 있습니다. 이 글은 한 칸이 텍스트로 저장된 7행짜리 표로 그룹 합계가 어떻게 나오는지, 그리고 숫자 형식을 지정한 뒤 어떤 숫자들로 결과를 대조했는지를 정리합니다.

## 표본 데이터

`Group`과 `Amount` 두 열이 있는 표(이름 `Input`)입니다. `B` 그룹의 `20`은 시트에서 텍스트로 저장된 셀입니다.

| Group | Amount | 셀 종류 |
| --- | --- | --- |
| A | 10 | 숫자 |
| A | (빈 셀) | 비어 있음 |
| A | 0 | 숫자 |
| B | 20 | 텍스트 |
| B | 5 | 숫자 |
| C | 0 | 숫자 |
| C | (빈 셀) | 비어 있음 |

Excel에서 `Amount` 열을 `SUM`으로 합하면 15입니다. 텍스트 `20`은 `SUM`이 더하지 않기 때문에 `10 + 0 + 5 + 0`만 계산된 값입니다. 행은 7개, 숫자가 들어 있는 셀은 5개(텍스트 `20` 포함)입니다.

## 형식을 지정하지 않은 그룹화

그룹별로 합계, 행 수, 비어 있지 않은 값의 수를 계산하는 쿼리입니다. 그룹화 기능으로 만들 수 있는 단계를 M으로 쓴 것이며, 합계는 `List.Sum`입니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content]
in
    Table.Group(S, {"Group"}, {
        {"Sum", each List.Sum([Amount])},
        {"Rows", each Table.RowCount(_), Int64.Type},
        {"NonNulls", each List.NonNullCount([Amount]), Int64.Type}
    })
```

시트에 로드된 결과는 다음과 같았습니다.

| Group | Sum | Rows | NonNulls |
| --- | --- | --- | --- |
| A | 10 | 3 | 2 |
| B | (빈 셀) | 2 | 2 |
| C | 0 | 2 | 1 |

`A`와 `C`는 정상이고 `B`의 `Sum`만 빈 셀로 읽혔습니다. `Rows`와 `NonNulls`는 `B`가 각각 2, 2라서 행도 값도 빠진 것이 없어 보입니다. 합계만 비어 있다는 점이 위험합니다. 시트로 읽은 값에서는 오류 셀이 감지되지 않았기 때문에, 이 칸이 빈 이유를 결과만 봐서는 알 수 없습니다.

## 원인을 따로 확인한 결과

각 그룹에서 `List.Sum`을 `try`로 감싸 오류 여부를 보는 진단 쿼리를 하나 더 만들었습니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    G = Table.Group(S, {"Group"}, {{"Try", each try List.Sum([Amount])}})
in
    Table.ExpandRecordColumn(
        Table.AddColumn(G, "Message", each if [Try][HasError] then [Try][Error][Message] else null),
        "Try", {"HasError"}, {"HasError"})
```

결과에서 `A`와 `C`의 `HasError`는 `FALSE`, `B`는 `TRUE`였고, `B`의 오류 메시지는 `- 연산자를 형식 Text 및 Text에 적용할 수 없습니다.`였습니다. 이 그룹에는 텍스트 `20`과 숫자 5가 섞여 있고 다른 그룹에는 텍스트가 없으므로, 텍스트가 섞인 값을 합하지 못해 오류가 난 것으로 보입니다. `List.Sum`은 문서에서 null이 아닌 값의 합을 반환한다고 설명하는 함수이지 텍스트를 숫자로 바꿔 주는 함수가 아닙니다.

## 숫자 형식을 지정한 뒤의 결과

`Amount`를 먼저 숫자 형식으로 바꿉니다. 텍스트 `20`의 해석 규칙을 고정하려고 culture를 `"en-US"`로 지정했습니다.

```powerquery
let
    S = Table.TransformColumnTypes(
            Excel.CurrentWorkbook(){[Name="Input"]}[Content],
            {{"Amount", type number}}, "en-US")
in
    Table.Group(S, {"Group"}, {
        {"Sum", each List.Sum([Amount]), type number},
        {"Rows", each Table.RowCount(_), Int64.Type},
        {"NonNulls", each List.NonNullCount([Amount]), Int64.Type}
    })
```

| Group | Sum | Rows | NonNulls |
| --- | --- | --- | --- |
| A | 10 | 3 | 2 |
| B | 25 | 2 | 2 |
| C | 0 | 2 | 1 |

`B`의 합계가 `20 + 5 = 25`로 채워졌습니다. 변환 단계에서 오류는 나지 않았습니다. 이 표본의 값만 가지고는 숫자가 아닌 텍스트(예: `12x`)가 섞였을 때의 동작은 말할 수 없습니다. 그 경우는 이 시험에서 확인하지 않았습니다.

## 대조에 쓴 숫자

- 그룹 합계의 합: `10 + 25 + 0 = 35`. 원본 `SUM` 15와 차이가 20이며, 텍스트 `20`의 값과 같습니다.
- `Rows`의 합: `3 + 2 + 2 = 7`. 원본 행 수 7과 같습니다.
- `NonNulls`의 합: `2 + 2 + 1 = 5`. 원본의 비어 있지 않은 셀 5개와 같습니다.
- `Table.RowCount`는 빈 값과 0이 있는 행도 센다는 것이 이 표본에서 확인되었습니다. `A`는 빈 값 1개와 0 1개를 포함하고도 `Rows`가 3이었습니다.

원본 `SUM`과 그룹 합계의 합이 다를 때는 값이 빠진 것이 아니라 텍스트로 저장된 숫자가 있다는 신호일 수 있습니다.

## 내 파일에 적용할 때 확인할 것

- [ ] 그룹화 전에 금액 열의 형식을 숫자로 지정하고, 텍스트 숫자가 어떻게 변환되는지 먼저 봅니다.
- [ ] 결과에서 합계가 빈 그룹이 있으면 그 그룹의 `Rows`와 `NonNulls`를 함께 봅니다.
- [ ] 그룹별 `Rows`의 합이 원본 행 수와 같은지 확인합니다.
- [ ] 그룹 합계의 합을 원본 `SUM`과 비교하고, 차이가 있으면 텍스트로 저장된 셀부터 찾습니다.
- [ ] 변환에 쓴 culture를 기록합니다. 이 글은 `"en-US"`로 지정했고, 다른 culture의 결과는 시험하지 않았습니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![텍스트 혼합으로 B의 Sum이 빈 칸인 결과](/images/excel-lab/power-query-group-by-subtotal/before.png)

텍스트 혼합으로 B의 Sum이 빈 칸인 결과.

![숫자형 변환 후 B의 Sum이 25인 결과](/images/excel-lab/power-query-group-by-subtotal/after.png)

숫자형 변환 후 B의 Sum이 25인 결과.

## 이 글에서 확인한 범위

- 환경: Windows의 데스크톱 Excel 16.0 빌드 20527, 한국어 UI(`ko-KR`)입니다.
- 데이터: 직접 만든 합성 데이터이며 이 글의 표본 데이터와 같은 값입니다. 실제 업무 데이터가 아닙니다.
- 실행 방식: 위 쿼리를 데스크톱 Excel에서 자동화 도구로 불러와 새로 고침하고 시트에 로드된 값을 읽었습니다. 사람이 메뉴를 하나씩 누른 기록이 아닙니다.
- 검증하지 못한 것: 리본 메뉴의 정확한 클릭 경로(그룹화 대화상자 포함), 다른 Excel 빌드와 다른 OS 로캘은 확인하지 않았습니다.
- `B`의 `Sum`이 빈 셀로 읽힌 것은 관찰된 값이며, 다른 빌드나 설정에서도 같다고 보장하지 않습니다.
