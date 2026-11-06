---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:07:15+09:00
title: "Power Query 병합에서 7행 중 2행만 맞을 때: 키 공백·탭 정리 전후 비교"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "excel"
  - "쿼리 병합"
  - "Text.Trim"
  - "데이터 정리"
description: "보기에는 같은 키 7행 중 2행만 병합되던 표를 Text.Trim과 Text.Clean으로 정리해 5행까지 맞추고, 끝까지 안 맞는 2행의 원인을 가르는 방법입니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/power-query/merge-queries-overview"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-nestedjoin"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-trim"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-clean"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-replace"
  - "https://learn.microsoft.com/en-us/powerquery-m/character-fromnumber"
testingStatus: not_tested
---

주문 목록의 거래처 코드를 코드표와 병합했는데 화면에서는 똑같아 보이는 키가 일부만 맞는 경우가 있습니다. 이 글은 키 7행짜리 표본으로 병합 결과를 세 번 비교하고, 어떤 정리가 몇 행을 살렸는지 숫자로 보여 줍니다.

## 표본 데이터

왼쪽 표(`Input`)의 `Key` 열과 오른쪽 코드표(`Lookup`)의 `Key` 열을 병합합니다. 코드표의 키는 `ALPHA`, `BETA`, `GAMMA`, `DELTA`, `OMEGA` 다섯 개이고 값은 1부터 5까지입니다.

| ID | Key의 실제 내용 | 눈에 보이는 문제 |
| --- | --- | --- |
| S1 | `ALPHA` | 없음 |
| S2 | `ALPHA` 뒤에 일반 공백 | 끝 공백 |
| S3 | `BETA` 뒤에 줄바꿈 없는 공백(U+00A0) | 끝 공백처럼 보임 |
| S4 | `ＧＡＭＭＡ` | 전각 문자 |
| S5 | `delta` | 소문자 |
| S6 | `OM`과 `EGA` 사이에 탭 | 중간 탭 |
| S7 | `BETA` | 없음 |

## 아무것도 정리하지 않고 병합한 결과

`Table.NestedJoin`으로 왼쪽 표를 기준으로 병합(Left Outer)하고, 오른쪽에서 짝을 찾았는지를 `Matched` 열로 만들었습니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    R = Excel.CurrentWorkbook(){[Name="Lookup"]}[Content],
    J = Table.NestedJoin(S, {"Key"}, R, {"Key"}, "Match", JoinKind.LeftOuter)
in
    Table.AddColumn(J, "Matched", each Table.RowCount([Match]) > 0)
```

관측된 `Matched`는 S1과 S7만 TRUE였고 나머지 5행은 FALSE였습니다. 7행 중 2행만 맞은 것입니다. 오류는 나지 않았고, 짝이 없는 행은 조용히 빈 결과로 남았습니다. 그래서 병합 뒤에 일치 건수를 세어 보지 않으면 놓치기 쉽습니다.

## 왜 맞지 않는지: 열마다 무엇이 바뀌는지 확인

원인을 추측하지 않고, 정리 함수를 하나씩 적용한 열을 나란히 만들어 비교했습니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    T = Table.AddColumn(S, "Trim", each Text.Trim([Key])),
    C = Table.AddColumn(T, "Clean", each Text.Clean([Key])),
    N = Table.AddColumn(C, "Normalized",
        each Text.Trim(Text.Clean(Text.Replace([Key], Character.FromNumber(160), " "))))
in
    N
```

| ID | Trim | Clean | Normalized |
| --- | --- | --- | --- |
| S2 | `ALPHA` | 끝 공백이 그대로 남음 | `ALPHA` |
| S3 | `BETA` | 끝의 U+00A0이 그대로 남음 | `BETA` |
| S6 | 탭이 그대로 남음 | `OMEGA` | `OMEGA` |
| S4 | 변화 없음 | 변화 없음 | 변화 없음 |
| S5 | 변화 없음 | 변화 없음 | 변화 없음 |

`Text.Trim`은 기본값으로 앞뒤 공백 문자를 제거하고, `Text.Clean`은 제어 문자를 제거합니다. 이 실행에서는 끝에 붙은 U+00A0도 `Text.Trim`이 제거했습니다. 그래서 `Text.Replace`로 U+00A0을 일반 공백으로 바꾸는 단계는 이 표본에서는 결과에 영향이 없었습니다. 다른 Excel 빌드에서도 같은지는 확인하지 않았으므로, 안전하게 가려면 이 단계를 남겨 두어도 됩니다.

## 정리 단계를 적용한 병합

키 열을 병합 전에 바꿉니다. 원본을 보존하려면 `Key`를 덮어쓰지 말고 별도 열에 정리한 값을 만들어 병합 키로 쓰는 편이 안전합니다. 아래는 실행한 그대로의 형태입니다.

```powerquery
let
    S = Table.TransformColumns(
        Excel.CurrentWorkbook(){[Name="Input"]}[Content],
        {{"Key", each Text.Trim(Text.Clean(Text.Replace(_, Character.FromNumber(160), " "))), type text}}),
    R = Excel.CurrentWorkbook(){[Name="Lookup"]}[Content],
    J = Table.NestedJoin(S, {"Key"}, R, {"Key"}, "Match", JoinKind.LeftOuter)
in
    Table.RemoveColumns(
        Table.AddColumn(J, "Matched", each Table.RowCount([Match]) > 0),
        {"Match"})
```

단계별 일치 건수는 다음과 같았습니다.

| 병합 키 | 일치 | 새로 맞은 행 |
| --- | --- | --- |
| 정리 없음 | 2행 (S1, S7) | |
| `Text.Trim`만 적용 | 4행 | S2, S3 |
| Trim, Clean, U+00A0 치환 | 5행 | S6 |

정리 뒤에도 S4와 S5, 두 행은 맞지 않았습니다.

## 남은 두 행과 대조

2(정리 없음) + 2(끝 공백 둘) + 1(탭) = 5이고, 맞지 않은 행이 2이므로 7행과 맞습니다. 행 수는 정리 전후 모두 7이었습니다. 병합이 행을 늘리거나 줄이지 않았다는 점도 함께 확인할 항목입니다.

S4는 전각 문자라서, S5는 코드표가 대문자인데 값이 소문자라서 맞지 않았습니다. 이 병합은 대소문자를 구별했습니다. 대문자나 소문자로 맞추는 `Text.Upper`·`Text.Lower`, 전각 문자 변환은 이 실행에서 시험하지 않았으므로 효과를 말할 수 없습니다. 이런 행은 정리 함수를 더하기 전에, 대소문자와 전각을 같은 값으로 볼지 업무 규칙부터 정해야 합니다.

## 내 파일에 적용할 점검표

- 병합 직후 TRUE·FALSE 건수를 세고, 짝이 없어야 할 행과 있어야 할 행을 구분합니다.
- 정리 열을 한 단계씩 나란히 만들어 어떤 함수가 어떤 행을 바꾸는지 봅니다.
- 정리 전후 행 수가 같은지 확인합니다.
- 남은 불일치 행은 눈으로 보지 말고 문자 코드(`Character.FromNumber`로 비교 가능)를 확인합니다.
- 키를 정리한 열로 병합하되, 원본 키 열은 따로 둡니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![정리 전 7행 중 2행만 일치한 결과](/images/excel-lab/power-query-merge-key-whitespace/before.png)

정리 전 7행 중 2행만 일치한 결과.

![공백 정리 후 5행 일치·2행 불일치 결과](/images/excel-lab/power-query-merge-key-whitespace/after.png)

공백 정리 후 5행 일치·2행 불일치 결과.

## 이 글에서 확인한 범위

- Windows 데스크톱 Excel 16.0, 빌드 20527, 한국어 UI에서 합성 데이터로 실행했습니다.
- 병합과 정리 쿼리는 데스크톱 Excel을 자동화해 실행했고, 위 숫자는 그 결과입니다.
- 확인하지 못한 것: 한국어 리본 메뉴의 클릭 경로, 다른 Excel 빌드와 다른 운영 체제 로캘, 대소문자·전각 문자를 맞추는 방법의 효과.
- `Text.Trim`이 U+00A0을 제거한 것은 이 빌드에서 관측한 동작입니다. 문서가 설명하는 기본 동작은 공백 문자 제거입니다.
