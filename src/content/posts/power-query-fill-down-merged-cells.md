---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:01:57+09:00
title: "병합 셀은 아래로 채우기로 풀리지만 빈 문자열 칸은 남습니다"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "병합 셀"
  - "아래로 채우기"
  - "excel"
  - "데이터 정리"
description: "병합 셀의 빈 칸 3개는 Power Query 아래로 채우기로 채워지지만 빈 문자열은 4행에 남는 사례와, null로 바꿔 채우는 M 코드를 보여 줍니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/power-query/fill-values-column"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-filldown"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-replacevalue"
  - "https://learn.microsoft.com/en-us/powerquery-m/excel-workbook"
testingStatus: not_tested
---

보고서 형식의 Excel 표에서 그룹명이 병합 셀로 들어 있으면 분석하기 전에 각 행에 그룹명을 채워야 합니다. Power Query의 아래로 채우기는 이럴 때 쓰는 기능인데, 채운다고 모든 빈 칸이 채워지지는 않습니다. 이 글은 실제 병합 셀이 있는 통합 문서를 읽어 아래로 채우기를 적용한 결과와, 채워지지 않고 남은 칸의 원인을 정리합니다.

## 표본 데이터

세 열(`Group`, `Item`, `Note`)과 6행짜리 시트입니다. `Group`은 두 행씩 묶어 병합했고(`A2:A3`, `A4:A5`, `A6:A7`), 병합 셀에는 위쪽 칸에만 값이 있습니다.

| Group | Item | Note |
| --- | --- | --- |
| Invented-A | S1 | Seed |
| (병합의 아래 칸) | S2 | (빈 칸) |
| Invented-B | S3 | (빈 문자열) |
| (병합의 아래 칸) | S4 | (빈 칸) |
| Invented-C | S5 | Next |
| (병합의 아래 칸) | S6 | (빈 칸) |

`S3`의 `Note` 칸은 빈 문자열이고 나머지 빈 칸은 값이 없는 셀입니다. 두 종류는 시트에서 같게 보입니다. 파일은 Excel 통합 문서로 저장하고 다음 쿼리로 읽었습니다. 경로는 `C:\샘플\input.xlsx`로 줄여 적었습니다.

```powerquery
let
    S = Excel.Workbook(File.Contents("C:\샘플\input.xlsx"), null, true),
    D = S{[Item="Input", Kind="Sheet"]}[Data]
in
    Table.PromoteHeaders(D, [PromoteAllScalars=true])
```

## 병합 셀은 이렇게 읽혔습니다

읽은 결과에서 `Group`이 `null`인 행은 3개였습니다. 병합의 아래 칸이 Power Query에서는 값 없는 칸(`null`)으로 읽힌 것입니다. `Note`는 `S2`, `S4`, `S6`이 `null`, `S3`은 빈 문자열(`""`)로 읽혔습니다. 행 수는 6행 그대로입니다.

## 아래로 채우기를 적용한 결과

```powerquery
Table.FillDown(query, {"Group", "Note"})
```

`query`는 위의 읽기 쿼리입니다. Microsoft 문서에 따르면 `Table.FillDown`은 null 값이 있는 칸에 위쪽의 값을 전파하고, 문서의 채우기 안내도 같은 설명입니다. 결과는 다음과 같았습니다.

| Group | Item | Note |
| --- | --- | --- |
| Invented-A | S1 | Seed |
| Invented-A | S2 | Seed |
| Invented-B | S3 | (빈 문자열) |
| Invented-B | S4 | (빈 문자열) |
| Invented-C | S5 | Next |
| Invented-C | S6 | Next |

`Group`은 3개 빈 칸이 모두 채워져 병합 셀 문제는 풀렸습니다. 그러나 `Note`의 `S4`는 `Seed`가 아니라 빈 문자열이 되었습니다. `S3`의 빈 문자열은 null이 아니기 때문에 값으로 취급되어 그 값이 아래로 전파된 것입니다.

## 빈 문자열이 얼마나 남는지 세어 본 결과

이 차이를 확인하려고 쿼리에 시험용 열 `LiteralEmpty`를 추가했습니다. `S1`은 `Seed`, `S3`은 빈 문자열, 나머지는 null입니다. 아래로 채운 뒤 값이 빈 문자열인 행에 표시하는 열(`IsEmptyString`)을 붙였습니다.

```powerquery
let
    S = Table.AddColumn(query, "LiteralEmpty",
            each if [Item]="S1" then "Seed" else if [Item]="S3" then "" else null, type text),
    F = Table.FillDown(S, {"Group", "LiteralEmpty"})
in
    Table.AddColumn(F, "IsEmptyString", each [LiteralEmpty]="", type logical)
```

채운 뒤 `LiteralEmpty`는 `S1`, `S2`가 `Seed`이고 `S3`부터 `S6`까지 4행이 빈 문자열이었고 `IsEmptyString`도 4행이 `TRUE`였습니다. 값이 채워진 것처럼 보이는 표라도 실제로는 빈 문자열 4행이 남아 있을 수 있다는 뜻입니다.

## 빈 문자열을 null로 바꾼 뒤 채우기

빈 문자열을 비어 있는 값으로 취급하기로 했다면 채우기 전에 null로 바꿉니다. Microsoft 문서에도 빈 칸처럼 보이는 값은 null로 바꾼 뒤에 채워야 한다는 설명이 있습니다.

```powerquery
let
    S = Table.AddColumn(query, "LiteralEmpty",
            each if [Item]="S1" then "Seed" else if [Item]="S3" then "" else null, type text),
    N = Table.ReplaceValue(S, "", null, Replacer.ReplaceValue, {"LiteralEmpty"})
in
    Table.FillDown(N, {"Group", "LiteralEmpty"})
```

이 결과에서 `LiteralEmpty`는 6행 모두 `Seed`였고 빈 문자열은 남지 않았습니다. 6행은 그대로이고 `Group`도 같은 값으로 채워졌습니다.

| 쿼리 | `Group` 빈 칸 | 빈 문자열이 남은 행 |
| --- | --- | --- |
| 읽기만 | 3 | `Note` 1행(`S3`) |
| 아래로 채우기만 | 0 | 4행(`S3`~`S6`, 시험 열 기준) |
| null로 바꾼 뒤 채우기 | 0 | 0 |

주의할 점은 `S3`의 빈 문자열이 `Seed`로 덮어써졌다는 것입니다. 이 칸이 실제로 비워 두려던 값이라면 바꾸면 안 됩니다. 어느 쪽인지는 데이터의 의미에 따라 사람이 정해야 합니다.

## 내 파일에 적용할 때 확인할 것

- [ ] 병합 셀을 푼 뒤 채우기 전에 대상 열의 `null` 개수와 빈 문자열 개수를 따로 셉니다.
- [ ] 채울 열을 `Group`처럼 병합이 있던 열로 한정합니다. 다른 열까지 채우면 빈 칸이 이전 행 값으로 바뀝니다.
- [ ] 빈 문자열을 비어 있는 값으로 볼지 결정하고, 그렇다면 채우기 전에 null로 바꿉니다.
- [ ] 채운 뒤 행 수가 채우기 전과 같은지 확인합니다.
- [ ] 채운 뒤 빈 칸이 남았다면 그 값이 null인지 빈 문자열인지 따로 확인합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![병합 셀을 읽은 뒤 Group에 남은 빈 칸](/images/excel-lab/power-query-fill-down-merged-cells/before.png)

병합 셀을 읽은 뒤 Group에 남은 빈 칸.

![Group·LiteralEmpty 채우기 후에도 남은 Note 빈 칸](/images/excel-lab/power-query-fill-down-merged-cells/after.png)

Group·LiteralEmpty 채우기 후에도 남은 Note 빈 칸.

## 이 글에서 확인한 범위

- 환경: Windows의 데스크톱 Excel 16.0 빌드 20527, 한국어 UI(`ko-KR`)입니다.
- 데이터: 직접 만든 합성 데이터이며 이 글의 표본 데이터와 같은 값입니다. 병합은 `A2:A3`, `A4:A5`, `A6:A7`로 실제 통합 문서에 만들어 읽었습니다.
- 실행 방식: 위 쿼리를 데스크톱 Excel에서 자동화 도구로 불러와 새로 고침하고 시트에 로드된 값을 읽었습니다. 사람이 메뉴를 하나씩 누른 기록이 아닙니다.
- 검증하지 못한 것: 리본 메뉴의 정확한 클릭 경로(아래로 채우기 메뉴 포함), 다른 Excel 빌드와 다른 OS 로캘은 확인하지 않았습니다. 글의 기능 이름과 채우기 안내는 Microsoft 문서의 설명을 따랐습니다.
- 시험 열 `LiteralEmpty`는 M에서 만든 값입니다. 다른 프로그램이 만든 CSV나 외부 시스템 파일에서 빈 칸이 null로 읽히는지 빈 문자열로 읽히는지는 이 시험으로 알 수 없습니다.
- 이 글의 결과는 위 빌드와 표본에서 관찰된 값이며, 다른 환경에서도 같다고 보장하지 않습니다.
