---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T22:45:25+09:00
title: "CSV의 03/04/2026이 로캘에 따라 3월 4일도 4월 3일도 될 때"
draft: true
topic: "excel-csv"
tags:
  - "csv"
  - "날짜 형식"
  - "excel"
  - "로캘"
  - "power query"
description: "같은 CSV 날짜를 en-US와 en-GB로 읽으면 6행 중 3행이 오류 없이 다른 날짜가 되는 것을 숫자로 보이고, 로캘을 지정해 검증하는 M 코드를 정리합니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/powerquery-m/table-transformcolumntypes"
  - "https://learn.microsoft.com/en-us/powerquery-m/date-fromtext"
  - "https://learn.microsoft.com/en-us/powerquery-m/date-totext"
  - "https://learn.microsoft.com/en-us/power-query/data-types"
  - "https://learn.microsoft.com/en-us/powerquery-m/csv-document"
testingStatus: not_tested
---

`03/04/2026`을 보고 3월 4일인지 4월 3일인지 알 수 있는 사람은 파일을 만든 쪽의 날짜 규칙을 아는 사람뿐입니다. 이 글은 같은 CSV 날짜 열을 `en-US`와 `en-GB`로 읽어 결과가 어떻게 갈리는지 숫자로 보여 주고, 읽은 뒤 검증하는 방법을 정리합니다.

## 표본 데이터

CSV는 UTF-8이고 날짜가 모두 `일/월/연` 또는 `월/일/연` 중 하나로 적혀 있다고 가정한 6행입니다. 어느 쪽인지는 파일 안에 적혀 있지 않습니다.

| ID | Date(텍스트 그대로) |
| --- | --- |
| S1 | `03/04/2026` |
| S2 | `25/04/2026` |
| S3 | `04/03/2026` |
| S4 | `12/11/2026` |
| S5 | `31/02/2026` |
| S6 | 빈 값 |

먼저 날짜를 변환하지 않고 텍스트로 읽는 쿼리입니다. 이 쿼리의 이름이 `query`이고, 아래 변환들은 이 쿼리를 입력으로 씁니다.

```powerquery
Table.PromoteHeaders(
    Csv.Document(File.Contents("C:\샘플\dates.csv"),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    [PromoteAllScalars=true])
```

경로는 글에 맞게 줄여 적었습니다.

## en-US로 읽은 결과

```powerquery
Table.TransformColumnTypes(query, {{"Date", type date}}, "en-US")
```

시트에 로드한 결과는 다음과 같았습니다.

| ID | en-US로 읽은 날짜 |
| --- | --- |
| S1 | 2026-03-04 |
| S2 | 빈 셀 |
| S3 | 2026-04-03 |
| S4 | 2026-12-11 |
| S5 | 빈 셀 |
| S6 | 빈 셀 |

S2와 S5는 날짜로 읽을 수 없어서 오류가 되었습니다. 시트에서는 오류 값이 아니라 빈 셀로 보였고, 오류의 내용은 따로 만든 점검 쿼리에서 `Date 값에 제공된 입력을 구문 분석할 수 없습니다.`로 확인되었습니다. 오류가 시트에 드러나지 않으므로, 변환 뒤 빈 날짜가 늘었는지 직접 세어야 합니다.

## en-GB로 읽은 결과

같은 쿼리에서 로캘만 `"en-GB"`로 바꿨습니다.

```powerquery
Table.TransformColumnTypes(query, {{"Date", type date}}, "en-GB")
```

| ID | en-GB로 읽은 날짜 |
| --- | --- |
| S1 | 2026-04-03 |
| S2 | 2026-04-25 |
| S3 | 2026-03-04 |
| S4 | 2026-11-12 |
| S5 | 빈 셀 |
| S6 | 빈 셀 |

## 두 결과의 차이

| 항목 | 건수 |
| --- | --- |
| 원본 행 | 6 |
| en-US 오류 | 2 (S2, S5) |
| en-GB 오류 | 1 (S5) |
| 두 로캘 모두 유효하지만 날짜가 달라진 행 | 3 (S1, S3, S4) |

위험한 것은 마지막 3행입니다. 오류가 나지 않고 값만 달라지므로 어느 쪽을 골라도 화면에는 정상으로 보입니다. S1은 en-US로는 3월 4일, en-GB로는 4월 3일입니다. S5의 `31/02/2026`은 두 로캘 모두에서 존재하지 않는 날짜입니다. 일부러 넣은 불량 값이며, 로캘을 맞춰도 이런 행은 남습니다.

## 어느 로캘이 맞는지 정하는 근거

데이터만으로 정할 수 있는 단서는 이 표본에서 S2 하나입니다. `25/04/2026`은 25를 월로 읽을 수 없으므로 일/월/연이라는 힌트가 됩니다. 이런 힌트는 한 행이라도 있으면 쓸모가 있지만, 모든 행이 12 이하라면 파일만 봐서는 구별할 수 없습니다. 이때는 파일을 보낸 쪽에 날짜 규칙을 확인해야 합니다. 이 판단은 표본을 보고 추론한 것이며 실험으로 확인한 사항은 아닙니다.

## 변환 결과를 검증하는 쿼리

원본 텍스트를 보존하고 변환 오류와 ISO 형식 날짜를 나란히 보는 쿼리입니다.

```powerquery
let
    S = Table.DuplicateColumn(query, "Date", "Original"),
    T = Table.TransformColumnTypes(S, {{"Date", type date}}, "en-GB"),
    A = Table.AddColumn(T, "Check", each
        let V = try [Date]
        in [HasError = V[HasError],
            ISO = if V[HasError] or V[Value] = null then null
                  else Date.ToText(V[Value], "yyyy-MM-dd", "en-US"),
            Message = if V[HasError] then V[Error][Message] else null]),
    R = Table.RemoveColumns(A, {"Date"})
in
    Table.ExpandRecordColumn(R, "Check", {"HasError", "ISO", "Message"})
```

`Table.TransformColumnTypes`의 세 번째 인수가 변환에 쓸 culture입니다. `Date.FromText`도 culture를 받습니다. Power Query 데스크톱은 culture를 지정하지 않으면 운영 체제의 지역 설정을 따른다고 문서에 설명되어 있습니다. 이 글의 실행은 모두 culture를 명시했고, 지정하지 않았을 때의 결과는 실행하지 않았습니다.

## Excel에서 CSV를 직접 열었을 때

같은 파일을 Excel로 직접 열었을 때 이 환경에서는 날짜 6칸이 모두 숫자가 아닌 텍스트로 남았습니다(`03/04/2026` 등이 그대로). Excel의 날짜 순서 설정은 연-월-일이었습니다. 다른 지역 설정에서는 다르게 변환될 수 있으며 이 부분은 시험하지 않았습니다.

## 점검표

- 날짜를 읽을 때 culture를 명시했고, 그 근거가 파일 발신자의 규칙인지 확인합니다.
- 변환 전후 행 수와 빈 날짜 수를 비교합니다.
- 일 또는 월이 12 이하인 행이 많은 파일은 두 로캘의 결과가 갈리는 행 수를 세어 봅니다.
- 존재하지 않는 날짜(`31/02`)처럼 로캘과 무관한 오류 행을 따로 모읍니다.
- 날짜를 `yyyy-MM-dd` 텍스트로 다시 내려 원본과 눈으로 대조합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![en-US로 읽은 날짜와 오류](/images/excel-lab/csv-date-day-month-swap-checklist/before.png)

en-US로 읽은 날짜와 오류.

![en-GB로 읽은 날짜와 오류](/images/excel-lab/csv-date-day-month-swap-checklist/after.png)

en-GB로 읽은 날짜와 오류.

## 이 글에서 확인한 범위

- Windows 데스크톱 Excel 16.0, 빌드 20527, 한국어 UI, 합성 데이터 6행으로 실행했습니다. 쿼리는 데스크톱 Excel을 자동화해 실행했습니다.
- 확인하지 못한 것: 한국어 리본 메뉴의 클릭 경로, 다른 Excel 빌드와 운영 체제 로캘, culture를 지정하지 않은 변환의 결과.
- 직접 열기 결과는 이 컴퓨터의 지역 설정에서만 관측했습니다.
