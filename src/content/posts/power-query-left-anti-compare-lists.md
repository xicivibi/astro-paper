---
author: "AI SEO Lab"
pubDatetime: 2026-09-20T04:22:00+09:00
title: "Power Query Left Anti로 두 명단의 누락 항목 찾기"
featured: false
draft: false
tags:
  - "excel"
  - "power query"
  - "데이터 비교"
description: "두 명단을 Power Query Left Anti로 비교할 때 텍스트 형식, 공백, 대소문자, 빈 값 규칙을 먼저 고정하고 누락 항목을 재현하는 절차입니다."
aiAssisted: true
lastReviewed: 2026-09-20T04:22:00+09:00
sources:
  - "https://support.microsoft.com/en-us/excel/merge-queries-power-query"
  - "https://learn.microsoft.com/en-us/power-query/merge-queries-left-anti"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-trim"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-upper"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-selectrows"
testingStatus: reproduced
---

회원 명단과 신청 명단, 발주 목록과 입고 목록처럼 **왼쪽 목록에만 있는 값**을 찾을 때 Power Query의 Left Anti 조인을 사용할 수 있습니다. Microsoft가 설명하는 Left Anti는 왼쪽 표의 행 가운데 오른쪽 표에 일치하는 행이 없는 것만 반환합니다.

기능을 선택하는 것만으로 비교가 끝나지는 않습니다. `003`과 `003 `, `A`와 `a`, 빈 문자열과 null을 같은 값으로 볼지 먼저 정해야 결과를 설명하고 다시 재현할 수 있습니다.

## 비교 전에 네 가지 규칙을 고정합니다

두 목록의 비교 열을 모두 **텍스트 형식**으로 맞춘 뒤 다음 규칙을 기록합니다.

1. 앞뒤 공백을 제거할지 정합니다.
2. 영문 대소문자를 같은 값으로 볼지 정합니다.
3. 빈 문자열과 null을 비교 대상에서 제외할지 정합니다.
4. 중복 키를 그대로 둘지, 별도 규칙으로 정리할지 정합니다.

주문 번호나 회원 번호처럼 선행 0이 의미를 가지는 값은 숫자로 바꾸지 않습니다. `001`을 숫자 `1`로 바꾸면 원본 식별자를 훼손하고 서로 다른 값을 잘못 합칠 수 있습니다.

## 원본 비교와 정규화 비교를 나눕니다

먼저 원본 텍스트를 그대로 Left Anti로 비교합니다. 이 결과는 실제 파일에 어떤 표기 차이가 있는지 보여 주는 진단용 기준입니다.

그다음 업무 규칙에서 공백과 대소문자를 무시해도 되는 경우에만 양쪽 목록에 같은 정규화를 적용합니다.

```powerquery
Text.Upper(Text.Trim([key]), "en-US")
```

빈 값을 제외하기로 했다면 조인 전에 양쪽 표에 같은 조건을 적용합니다.

```powerquery
Table.SelectRows(Source, each [key] <> null and [key] <> "")
```

`Text.Trim`은 기본적으로 앞뒤 공백을 제거하고, `Text.Upper`는 지정한 culture에 따라 대문자로 변환합니다. `Table.SelectRows`는 조건을 만족하는 행만 남깁니다. 이 변환은 비교용 열에 적용하고 원본 열은 함께 보존해야 차이를 추적할 수 있습니다.

## Left Anti 조인을 실행합니다

Power Query 편집기에서 두 쿼리를 준비한 뒤 다음 순서로 비교합니다.

1. 왼쪽 쿼리에서 **홈 > 쿼리 병합 > 쿼리를 새 항목으로 병합**을 선택합니다.
2. 첫 번째 표와 두 번째 표에서 비교할 열을 같은 순서로 선택합니다.
3. 두 열의 자료형이 모두 텍스트인지 확인합니다.
4. 조인 종류에서 **Left Anti**를 선택합니다.
5. 결과 행 수와 원본 키를 확인한 뒤 로드합니다.

M 코드로 같은 동작을 표현하면 핵심은 `JoinKind.LeftAnti`입니다.

```powerquery
Table.NestedJoin(
    LeftTable,
    {"key"},
    RightTable,
    {"key"},
    "right",
    JoinKind.LeftAnti
)
```

여러 열을 함께 비교한다면 양쪽에서 같은 개수의 열을 같은 순서로 선택합니다. 한쪽은 고객 번호만, 다른 쪽은 고객 번호와 날짜를 선택하는 식의 비대칭 비교는 사용할 수 없습니다.

## 실제 재현 결과

2026년 9월 13일 Windows의 Excel 16.0 빌드 20326, `ko-KR` 환경에서 고정된 합성 입력을 Power Query M으로 실행했습니다.

원본 텍스트를 그대로 비교한 Left Anti 결과는 다음과 같았습니다.

```text
001
003␠
a
```

`003␠`은 끝에 공백이 있는 값입니다. 양쪽 목록에 `Text.Trim`과 `en-US` 기준 `Text.Upper`를 적용하고 빈 값을 제외한 결과는 다음 한 건이었습니다.

```text
001
```

| 비교 방식 | 왼쪽에만 남은 값 | 결과 자료형 |
|---|---|---|
| 원본 텍스트 | `001`, `003␠`, `a` | text |
| Trim + Upper + 빈 값 제외 | `001` | text |

두 결과에서 키 자료형은 텍스트로 유지됐습니다. 이 차이는 Left Anti가 임의로 값을 정리해서 생긴 것이 아니라, 두 번째 비교에서 양쪽에 동일한 정규화 규칙을 먼저 적용했기 때문입니다.

## 결과가 예상과 다를 때 확인할 것

- `001`이 `1`로 바뀌었다면 양쪽 열이 텍스트인지 확인합니다.
- 화면상 같은 값인데 일치하지 않으면 앞뒤 공백과 대소문자를 확인합니다.
- 빈 행이 결과에 남으면 빈 문자열과 null 처리 조건을 각각 확인합니다.
- 예상보다 행이 많으면 양쪽 목록의 중복 키 개수를 따로 셉니다.
- 여러 열을 비교했다면 선택한 열의 개수와 순서가 같은지 확인합니다.

원본 결과와 정규화 결과를 둘 다 보관하면 “누락”과 “표기 차이”를 구분할 수 있습니다. 정규화 결과만 남기면 원본 데이터의 품질 문제를 놓칠 수 있습니다.

## 이 글의 확인 범위

이 글의 실행 결과는 Windows, `ko-KR`, Excel 16.0 빌드 20326과 해시가 고정된 합성 입력에 한정됩니다.

- Left Anti 원본·정규화 비교 재현 artifact: `5c4efffdf5a4dd8442485f2dc08578fac70a09ad285c3e0a69f43480ba3c7bc1`
- 원시 Excel 캡처 SHA-256: `ea426ee995e1e21240dea9909d4d620ce29b8c936d95870da5b84d71711fe6d6`
- 재현 날짜: 2026년 9월 13일

Microsoft Support의 제품 적용 범위는 Excel for Microsoft 365, Microsoft 365 for Mac, Excel 2024, Excel 2021이며 Left Anti의 의미를 직접 설명합니다. 위의 정확한 출력값은 기록된 한 Excel 빌드와 합성 입력에서 확인한 결과입니다. 다른 데이터, 로캘, Excel 빌드의 출력이나 XLOOKUP·MATCH 동작은 이 재현으로 보장하지 않습니다.

## 검증 체크리스트

- [ ] 양쪽 비교 열을 텍스트로 맞췄습니다.
- [ ] 선행 0이 있는 식별자를 숫자로 바꾸지 않았습니다.
- [ ] 공백과 대소문자 처리 규칙을 기록했습니다.
- [ ] 빈 문자열과 null 처리 규칙을 정했습니다.
- [ ] 원본 비교와 정규화 비교를 나눠 확인했습니다.
- [ ] 여러 비교 열의 개수와 선택 순서가 같습니다.
- [ ] 결과 행 수와 원본 키를 대조했습니다.
- [ ] 원본 파일과 원본 쿼리를 보존했습니다.

비교 전에 키 열의 공백과 대소문자 규칙을 정해야 한다면 [Power Query 중복 제거 전에 비교 키와 정규화 규칙 정하기](/posts/power-query-remove-duplicates-key-normalization/)도 함께 확인하세요.
