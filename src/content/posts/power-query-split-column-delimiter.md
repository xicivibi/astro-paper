---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T22:55:06+09:00
title: "Power Query 열 분할에서 구분자 조각이 늘어나면 생기는 일"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "열 분할"
  - "구분 기호"
  - "excel"
  - "데이터 정리"
description: "|로 나눈 열에 조각이 4개인 행이 나중에 들어오면 열 3개로 고정한 분할이 Q를 조용히 버리는 사례와, 열 수를 계산해 4열로 되살리는 M 코드를 정리합니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/powerquery-m/table-splitcolumn"
  - "https://learn.microsoft.com/en-us/powerquery-m/splitter-splittextbydelimiter"
  - "https://learn.microsoft.com/en-us/powerquery-m/extravalues-type"
testingStatus: not_tested
---

한 칸에 `A|B|C`처럼 구분자로 이어 붙인 값을 열로 나눌 때, 조각이 최대 3개라고 보고 새 열을 `P1`, `P2`, `P3`으로 정해 두는 일이 많습니다. 그런데 나중에 조각이 4개인 행이 들어오면 어떻게 될까요? 이 글은 Excel Power Query의 `Table.SplitColumn`을 열 3개로 고정했을 때와 조각 수에 맞춰 열 수를 계산했을 때를 같은 입력으로 비교한 기록입니다.

## 표본 데이터

`ID`와 `Parts` 두 열이 있고, 구분자는 세로 막대(`|`)입니다. 표 이름은 `Input`입니다.

| ID | Parts | 조각 수 | 비고 |
| --- | --- | --- | --- |
| S1 | `A\|B\|C` | 3 | 기준 행 |
| S2 | `D\|E` | 2 | 뒤쪽이 모자람 |
| S3 | `F` | 1 | 구분자 없음 |
| S4 | `G\|H, I\|J` | 3 | 가운데 값에 쉼표 |
| S5 | `K\|\|M` | 3 | 가운데가 비어 있음 |

표의 `\|`는 마크다운 표 안에서 세로 막대를 쓰기 위한 표기이며, 실제 셀에는 `|` 하나만 들어 있습니다. 이 5행을 먼저 불러온 뒤, 조각이 4개인 `S6`(`N|O|P|Q`)을 추가해 새로 고침했습니다.

## 열 3개로 고정한 분할

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content]
in
    Table.SplitColumn(S, "Parts", Splitter.SplitTextByDelimiter("|", QuoteStyle.Csv), {"P1", "P2", "P3"})
```

처음 5행의 결과는 다음과 같았습니다. 빈 칸으로 보이는 셀 중 일부는 `null`이고 일부는 빈 문자열(`""`)이었습니다.

| ID | P1 | P2 | P3 |
| --- | --- | --- | --- |
| S1 | A | B | C |
| S2 | D | E | null |
| S3 | F | null | null |
| S4 | G | H, I | J |
| S5 | K | 빈 문자열 | M |

`S4`의 `H, I`는 쉼표가 있어도 한 조각으로 남았습니다. 구분자가 `|`이므로 쉼표는 나눔 기준이 아니었습니다. 눈에 띄는 차이는 `S2`, `S3`의 모자란 칸이 `null`인 반면 `S5`의 가운데 칸은 `null`이 아니라 빈 문자열이라는 점입니다. 시트에서는 둘 다 빈 셀로 보이지만 값의 종류가 다릅니다.

## 조각이 4개인 행을 추가한 뒤

`S6`을 추가하고 새로 고침하자 6행이 되었지만 열은 여전히 `ID`, `P1`, `P2`, `P3`의 4개였습니다. `S6` 행은 `N`, `O`, `P`로 채워졌고, 네 번째 조각 `Q`는 어디에도 나타나지 않았습니다. 오류도, 경고도 없었습니다.

Microsoft 문서에 따르면 `Table.SplitColumn`의 마지막 인수(`extraColumns`)는 분할된 값이 새 열보다 많을 때의 동작을 정하고, 기본값은 `ExtraValues.Ignore`입니다. 위 결과는 이 기본 동작과 일치합니다. 쿼리를 확인하는 사람이 열 개수만 보면 데이터가 조용히 잘린 것을 알아채기 어렵습니다.

## 더 많은 조각을 오류로 만들었을 때

같은 호출에 `ExtraValues.Error`를 넘긴 쿼리도 시험했습니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    T = Table.SplitColumn(S, "Parts", Splitter.SplitTextByDelimiter("|", QuoteStyle.Csv),
                          {"P1", "P2", "P3"}, null, ExtraValues.Error)
in
    T
```

`S1`~`S5`는 앞의 결과와 같았습니다. `S6` 행은 `ID`만 남고 `P1`, `P2`, `P3`이 모두 빈 셀로 읽혔습니다. 즉 `N|O|P`도 함께 사라졌고 행 자체는 6행으로 유지되었습니다. 시트로 읽은 값에서는 오류 셀로 감지된 것이 없었습니다. 셀이 비어 보이는 이유가 오류 때문인지는 이 실험에서 따로 확인하지 못했습니다. 그래서 이 설정이 "문제를 눈에 띄게 알려 준다"고 말하기는 어렵고, 조각이 많은 행의 값이 통째로 비는 동작이 관찰되었다고만 적습니다.

## 조각 수에 맞춰 열 수를 계산하는 쿼리

열 수를 직접 쓰지 않고, 값마다 조각 수를 센 뒤 가장 큰 값만큼 열 이름을 만듭니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    N = List.Max(List.Transform(S[Parts],
            each List.Count(Splitter.SplitTextByDelimiter("|", QuoteStyle.Csv)(_)))),
    Result = Table.SplitColumn(S, "Parts", Splitter.SplitTextByDelimiter("|", QuoteStyle.Csv),
                 List.Transform({1..N}, each "P" & Text.From(_)), null, ExtraValues.Error)
in
    Result
```

`S6`을 포함한 6행에서 `N`은 4가 되어 결과가 `ID`, `P1`~`P4`의 5열이 되었습니다. `S6`은 `N`, `O`, `P`, `Q`로 모두 남았고 `S1`~`S5`의 `P4`는 비어 있었습니다. 이 쿼리에서는 열 수가 데이터에서 계산되므로 `ExtraValues.Error`가 걸릴 일이 없고, 새 행이 6조각이 되어도 같은 쿼리가 열을 늘립니다. 다만 이 확장 동작은 4조각까지만 확인했습니다.

| 쿼리 | 결과 열 | 행 수 | `S6`의 `Q` |
| --- | --- | --- | --- |
| 열 3개 고정(기본) | `ID`, `P1`~`P3`(4열) | 6 | 사라짐 |
| 열 3개 고정, `ExtraValues.Error` | `ID`, `P1`~`P3`(4열) | 6 | `P1`~`P3`이 모두 빈 셀 |
| 조각 수로 열 수 계산 | `ID`, `P1`~`P4`(5열) | 6 | `P4`에 `Q` |

## 내 파일에 적용할 때 확인할 것

- [ ] 분할 전에 조각 수를 센 값의 최댓값을 구해 새 열 수와 비교합니다.
- [ ] 분할 전후 행 수가 같은지 확인합니다.
- [ ] 분할된 열의 `null`과 빈 문자열을 구분해서 센 뒤, 의도한 값인지 확인합니다.
- [ ] 값 안에 구분자가 들어 있을 수 있다면 따옴표 처리(`QuoteStyle.Csv`)를 쓸지 정하고 샘플로 확인합니다. 이 글의 표본에서는 따옴표가 있는 값을 시험하지 않았습니다.
- [ ] 새 행을 추가해 새로 고침하고, 마지막 조각이 결과에 있는지 확인합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![고정 3열 분할에서 S6의 Q가 빠진 결과](/images/excel-lab/power-query-split-column-delimiter/before.png)

고정 3열 분할에서 S6의 Q가 빠진 결과.

![동적 4열 분할에서 S6의 Q를 보존한 결과](/images/excel-lab/power-query-split-column-delimiter/after.png)

동적 4열 분할에서 S6의 Q를 보존한 결과.

## 이 글에서 확인한 범위

- 환경: Windows의 데스크톱 Excel 16.0 빌드 20527, 한국어 UI(`ko-KR`)입니다.
- 데이터: 직접 만든 합성 데이터이며 이 글의 표본 데이터와 같은 값입니다. 실제 업무 데이터가 아닙니다.
- 실행 방식: 위 쿼리를 데스크톱 Excel에서 자동화 도구로 불러와 새로 고침하고 시트에 로드된 값을 읽었습니다. 사람이 메뉴를 하나씩 누른 기록이 아닙니다.
- 검증하지 못한 것: 리본 메뉴의 정확한 클릭 경로, 다른 Excel 빌드와 다른 OS 로캘에서의 동작, 글을 사람이 검토하는 절차는 확인하지 않았습니다.
- 이 글은 구분자 `|`와 위 6행만 다룹니다. 따옴표가 포함된 값, 공백 처리, 대용량 데이터는 시험하지 않았습니다.
- 결과는 위 빌드와 표본에서 관찰된 값이며, 다른 환경에서도 같다고 보장하지 않습니다.
