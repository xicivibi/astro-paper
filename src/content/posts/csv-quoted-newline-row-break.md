---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:13:07+09:00
title: "CSV 메모 칸의 줄바꿈 때문에 5행이 7행으로 늘어날 때 QuoteStyle 확인"
draft: true
topic: "excel-csv"
tags:
  - "csv"
  - "excel"
  - "줄바꿈"
  - "power query"
  - "QuoteStyle"
description: "따옴표 안에 줄바꿈이 든 CSV 5행이 QuoteStyle.None에서는 7행으로 쪼개지고 기본 설정에서는 5행으로 유지된 결과와 행 수 대조 방법을 보여 줍니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/powerquery-m/csv-document"
  - "https://learn.microsoft.com/en-us/powerquery-m/quotestyle-type"
  - "https://learn.microsoft.com/en-us/power-query/connectors/text-csv"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-promoteheaders"
testingStatus: not_tested
---

메모나 비고 칸에 줄바꿈이 들어 있는 CSV를 가져왔더니 행 수가 원본보다 늘어나는 경우가 있습니다. 이 글은 따옴표 안에 줄바꿈이 든 5개 레코드를 두 가지 설정으로 읽어 행 수가 어떻게 달라지는지 기록합니다. 먼저 짚어 둘 점은, 이 실행에서 기본 설정은 행을 쪼개지 않았다는 것입니다.

## 표본 데이터

레코드는 5개입니다. S1과 S4의 `Note`에는 줄바꿈이 들어 있고, S3의 `Note`에는 큰따옴표와 쉼표가 들어 있습니다.

| ID | Note | Amount |
| --- | --- | --- |
| S1 | `first` 줄바꿈 `second` | 10 |
| S2 | `plain` | 20 |
| S3 | `has "quotes", comma` | 30 |
| S4 | `third` 줄바꿈 `fourth` | 40 |
| S5 | `end` | 50 |

CSV 파일에서는 이렇게 줄바꿈이 따옴표 안에 놓입니다. 파일은 줄 단위로 보면 데이터가 7줄이지만 레코드는 5개입니다.

```text
ID,Note,Amount
S1,"first
second",10
S2,plain,20
S3,"has ""quotes"", comma",30
S4,"third
fourth",40
S5,end,50
```

## 기본 설정으로 읽은 결과

```powerquery
Table.PromoteHeaders(
    Csv.Document(File.Contents("C:\샘플\notes.csv"),
        [Delimiter=",", Encoding=65001]),
    [PromoteAllScalars=true])
```

경로는 글에 맞게 줄여 적었습니다. 결과는 5행이었고, S1의 `Note`는 `first`와 `second` 사이의 줄바꿈을 유지한 하나의 값이었습니다. Excel에서 같은 CSV를 직접 열었을 때도 5행이었습니다. Csv.Document 문서는 `QuoteStyle`의 기본값이 `QuoteStyle.Csv`이며 따옴표 안의 줄바꿈을 데이터의 일부로 처리한다고 설명합니다. 이 실행은 문서 설명과 일치했습니다.

## QuoteStyle.None으로 읽은 결과

```powerquery
Table.PromoteHeaders(
    Csv.Document(File.Contents("C:\샘플\notes.csv"),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.None]),
    [PromoteAllScalars=true])
```

결과는 7행이었습니다.

| ID | Note | Amount |
| --- | --- | --- |
| S1 | first | (빈 값) |
| second" | 10 | (빈 값) |
| S2 | plain | 20 |
| S3 | has "quotes", comma | 30 |
| S4 | third | (빈 값) |
| fourth" | 40 | (빈 값) |
| S5 | end | 50 |

문서에 따르면 `QuoteStyle.None`은 따옴표 안이어도 모든 줄바꿈을 행의 끝으로 처리합니다. 표에서 그대로 보입니다. S1은 두 행으로 나뉘어 둘째 행의 `ID` 칸에 `second"`가 들어갔고, 원래 `Amount`였던 10은 `Note` 칸으로 밀렸습니다. S4도 같은 모양입니다. 레코드 5개에 쪼개진 행 2개가 더해져 7행입니다.

이 증상은 줄 수와 맞습니다. 파일의 데이터 줄이 7줄이므로 줄 단위로 읽는 방식에서는 7행이 나옵니다.

## 어떤 상황에서 이 설정이 되는가

기본 호출에는 `QuoteStyle` 인수가 없었습니다. 따라서 이 증상은 코드에 `QuoteStyle.None`이 명시되어 있거나, 가져오기 대화 상자에서 따옴표 안 줄바꿈을 행 끝으로 처리하도록 골랐을 때 의심할 수 있습니다. Text/CSV 커넥터 문서에는 이 선택을 **Line breaks** 항목에서 `Ignore quoted line breaks` 또는 `Apply all line breaks`로 고르는 설명이 있습니다. 어느 화면에서 어느 값이 `QuoteStyle.None`이 되는지는 이 실험에서 확인하지 않았습니다.

## 고치는 방법과 대조

고치는 방법은 `QuoteStyle=QuoteStyle.None`을 제거하거나 `QuoteStyle=QuoteStyle.Csv`로 바꾸는 것입니다. 옵션이 없는 기본 설정이 5행이었고 `Amount`가 10, 20, 30, 40, 50으로 제자리에 있었으므로 같은 결과를 기대할 수 있습니다. `QuoteStyle.Csv`를 명시한 쿼리는 따로 실행하지 않았습니다.

대조는 레코드 수로 합니다.

| 읽은 방식 | 행 수 |
| --- | --- |
| 원본 레코드 | 5 |
| 기본 설정 | 5 |
| `QuoteStyle.None` | 7 |
| Excel에서 직접 열기 | 5 |

원본 레코드 수는 파일을 보낸 쪽에서 받거나, 줄바꿈이 없는 키 열(`ID`)의 고유 개수로 셉니다.

## 점검표

- 가져온 행 수가 원본 레코드 수와 같은지 봅니다.
- `ID` 칸에 따옴표가 붙은 조각(`second"`)이나 숫자가 보이면 행이 쪼개진 것입니다.
- 금액 열이 비거나 값이 옆 열로 밀려 있는지 확인합니다.
- 코드의 `Csv.Document` 옵션에 `QuoteStyle.None`이 있는지 찾습니다.
- 줄바꿈이 필요 없는 열이라면, 읽은 뒤 `Text.Clean`이나 `Text.Replace`로 정리하는 방법을 별도로 검토합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![QuoteStyle.None에서 7행으로 갈라진 결과](/images/excel-lab/csv-quoted-newline-row-break/before.png)

QuoteStyle.None에서 7행으로 갈라진 결과.

![기본 Csv.Document로 5행을 유지한 결과](/images/excel-lab/csv-quoted-newline-row-break/after.png)

기본 Csv.Document로 5행을 유지한 결과.

## 이 글에서 확인한 범위

- Windows 데스크톱 Excel 16.0, 빌드 20527, 한국어 UI, 합성 데이터 5레코드로 실행했습니다. 쿼리는 데스크톱 Excel을 자동화해 실행했습니다.
- CRLF 줄바꿈이 든 파일에서만 관측했습니다.
- 확인하지 못한 것: 한국어 리본 메뉴의 클릭 경로, 가져오기 대화 상자의 옵션이 어떤 `QuoteStyle` 값으로 이어지는지, 다른 Excel 빌드와 운영 체제 로캘, 대용량 파일, 줄바꿈 정리 함수의 결과.
