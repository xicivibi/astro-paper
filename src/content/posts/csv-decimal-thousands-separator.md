---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:10:15+09:00
title: "CSV 숫자 1.234가 1.234일까 1234일까: 합계가 같아도 틀릴 수 있는 이유"
draft: true
topic: "excel-csv"
tags:
  - "csv"
  - "excel"
  - "로캘"
  - "숫자 형식"
  - "power query"
description: "소수점 기호가 다른 CSV 숫자를 한 로캘로 읽으면 합계가 우연히 같아도 값이 100배·1000배 틀어진다는 것을 6행 표본으로 보이고, 원본 로캘별로 읽는 M 코드를 보여 줍니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/powerquery-m/number-fromtext"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-transformcolumntypes"
  - "https://learn.microsoft.com/en-us/power-query/data-types"
  - "https://learn.microsoft.com/en-us/powerquery-m/csv-document"
testingStatus: not_tested
---

독일식 `1.234,56`과 미국식 `1,234.56`은 같은 숫자의 다른 표기입니다. 한 CSV 안에 두 표기가 섞이거나, 한 표기 파일을 다른 로캘로 읽으면 어떤 일이 생기는지 6행 표본으로 기록했습니다. 가장 눈여겨볼 점은 합계가 서로 같게 나왔는데도 행별 값은 틀렸다는 것입니다.

## 표본 데이터

`SourceLocale` 열에는 각 행이 어느 로캘 규칙으로 적혔는지 표시해 두었습니다. 의도한 숫자는 모두 1234.56 또는 1234입니다.

| ID | Number(텍스트) | SourceLocale | 의도한 값 |
| --- | --- | --- | --- |
| S1 | `1.234,56` | de-DE | 1234.56 |
| S2 | `1,234.56` | en-US | 1234.56 |
| S3 | `1.234` | de-DE | 1234 |
| S4 | `1,234` | en-US | 1234 |
| S5 | `1234,56` | de-DE | 1234.56 |
| S6 | `1234.56` | en-US | 1234.56 |

쿼리 `query`는 CSV를 변환 없이 텍스트로 읽습니다.

```powerquery
Table.PromoteHeaders(
    Csv.Document(File.Contents("C:\샘플\numbers.csv"),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    [PromoteAllScalars=true])
```

경로는 글에 맞게 줄여 적었습니다. 쉼표가 들어간 값은 CSV 안에서 큰따옴표로 감쌌습니다.

## 하나의 로캘로 전체를 읽은 결과

```powerquery
Table.TransformColumnTypes(query, {{"Number", type number}}, "en-US")
```

| ID | en-US로 읽음 | 비고 |
| --- | --- | --- |
| S1 | 오류(빈 셀) | `Number로 변환할 수 없습니다.` |
| S2 | 1234.56 | 맞음 |
| S3 | 1.234 | 의도한 1234의 1/1000 |
| S4 | 1234 | 맞음 |
| S5 | 123456 | 의도한 1234.56의 100배 |
| S6 | 1234.56 | 맞음 |

같은 열을 `"de-DE"`로 읽으면 반대 방향으로 틀어졌습니다. S2가 오류, S4가 1.234(의도값의 1/1000), S6이 123456(100배)이 되었고 S1, S3, S5는 맞았습니다.

## 합계로는 못 잡습니다

| 읽은 방식 | 합계 |
| --- | --- |
| en-US로 전체 읽기 | 127160.35399999999 |
| de-DE로 전체 읽기 | 127160.354 |

두 합계는 부동소수점 표시 차이를 빼면 같습니다. 계산해 보면 이유가 보입니다. en-US는 `1234.56 + 1.234 + 1234 + 123456 + 1234.56`이고, de-DE는 `1234.56 + 1234 + 1.234 + 1234.56 + 123456`입니다. 항이 같은 값끼리 뒤섞였을 뿐입니다. 오류 행이 빠졌는데도 합계가 같아 보여서, 합계 하나만 대조하면 이 문제를 놓칠 수 있습니다. 다만 이것은 이 표본의 구성에서 나온 결과이며 실제 파일에서도 합계가 같을 것이라는 뜻은 아닙니다. 두 해석에서 값이 서로 1000배 차이 나는 행이 2개(S3, S4), 100배 차이 나는 행이 2개(S5, S6)였습니다.

## 행마다 로캘을 지정해 읽기

원본 로캘을 아는 열이 있다면 `Number.FromText`에 culture를 넘깁니다.

```powerquery
Table.AddColumn(query, "Parsed",
    each Number.FromText([Number], [SourceLocale]), type number)
```

결과는 다음과 같았습니다.

| ID | Parsed |
| --- | --- |
| S1 | 1234.56 |
| S2 | 1234.56 |
| S3 | 1234 |
| S4 | 1234 |
| S5 | 1234.56 |
| S6 | 1234.56 |

6행 모두 의도한 값과 같았고, 합계는 7406.24였습니다. 계산식은 `1234.56 × 4 + 1234 × 2`입니다.

## 이 방법이 통하는 조건

`1.234`는 값 자체만으로는 1.234인지 1234인지 알 수 없습니다. 위 결과가 맞은 것은 `SourceLocale`이 행마다 정답을 알려 주었기 때문입니다. 실제 파일에서는 그런 열이 없는 경우가 많습니다. 그럴 때는 파일을 만든 시스템의 설정을 확인해서 파일 전체에 하나의 culture를 정하고 `Table.TransformColumnTypes`의 culture 인수로 지정합니다. 한 파일 안에서 로캘이 섞여 있다면 값만 보고 구분하는 방법은 이 실험에서 다루지 않았습니다.

## 점검표

- 숫자 열에서 오류(빈 셀)가 생긴 행 수를 셉니다.
- 소수점과 천 단위 구분 기호가 하나만 있는 값(`1.234`, `1,234`)을 따로 골라 의미를 확인합니다.
- 합계만이 아니라 최댓값과 최솟값, 몇 행의 원본 대조를 함께 합니다.
- culture를 코드에 명시하고, 그 근거를 파일 발신처의 설정으로 남깁니다.
- 가져온 뒤의 행 수가 원본과 같은지 확인합니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![전체 열을 en-US로 읽은 숫자와 오류](/images/excel-lab/csv-decimal-thousands-separator/before.png)

전체 열을 en-US로 읽은 숫자와 오류.

![행별 SourceLocale을 적용한 숫자](/images/excel-lab/csv-decimal-thousands-separator/after.png)

행별 SourceLocale을 적용한 숫자.

## 이 글에서 확인한 범위

- Windows 데스크톱 Excel 16.0, 빌드 20527, 한국어 UI, 합성 데이터 6행에서 실행했습니다. 쿼리는 데스크톱 Excel을 자동화해 실행했습니다.
- 이 환경의 Excel 소수점 기호는 `.`, 천 단위 구분 기호는 `,`였습니다.
- 확인하지 못한 것: 한국어 리본 메뉴의 클릭 경로, 다른 Excel 빌드와 운영 체제 로캘, Excel에서 CSV를 직접 열었을 때의 숫자 해석, 한 파일 안에서 섞인 표기를 값만으로 가르는 방법.
