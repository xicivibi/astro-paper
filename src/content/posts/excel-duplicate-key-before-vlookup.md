---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:19:10+09:00
title: "조회 키 중복이 합계를 360 줄인 사례: VLOOKUP·XLOOKUP 전에 COUNTIF로 확인하기"
draft: true
topic: "excel-csv"
tags:
  - "excel"
  - "VLOOKUP"
  - "XLOOKUP"
  - "COUNTIF"
  - "Power Query"
description: "단가표에 같은 키가 두 번 있으면 VLOOKUP과 XLOOKUP이 오류 없이 첫 값만 가져옵니다. 5행 표본에서 합계가 280과 640으로 갈린 과정과 사전 점검법을 담았습니다."
aiAssisted: true
sources:
  - "https://support.microsoft.com/en-us/office/xlookup-function-b7fd680e-6d10-43e6-84f9-88eae8bf5929"
  - "https://support.microsoft.com/en-us/office/vlookup-function-0bbc8083-26fe-4963-8ab8-93a18ad188a1"
  - "https://support.microsoft.com/en-us/office/countif-function-e0de10c6-f885-4e71-abb4-1f464816df34"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-group"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-selectrows"
testingStatus: not_tested
---

주문 수량에 단가표의 단가를 곱해 금액을 만들 때, 단가표에 같은 키가 두 번 들어 있으면 `VLOOKUP`이나 `XLOOKUP`은 경고 없이 한 값만 돌려줍니다. 결과가 숫자로 잘 나오기 때문에 합계가 틀려도 눈에 띄지 않습니다. 이 글은 5행짜리 합성 주문표와 6행짜리 단가표로 이 문제를 재현하고, 조회 전에 중복을 찾는 방법과 합계가 얼마나 달라졌는지를 기록합니다.

## 표본 데이터

주문표(`Input`)는 키 `A`부터 `E`까지 한 줄씩이고, 단가표(`Lookup`)에는 키 `B`가 두 줄 있습니다.

| ID | Key | Quantity |
| --- | --- | --- |
| S1 | A | 1 |
| S2 | B | 2 |
| S3 | C | 3 |
| S4 | D | 1 |
| S5 | E | 2 |

| Lookup Key | Price |
| --- | --- |
| A | 10 |
| B | 20 |
| B | 200 |
| C | 30 |
| D | 40 |
| E | 50 |

비교를 위해 중복을 정리한 `Approved` 표도 만들었습니다. 키별로 단가가 하나씩이고 B는 200입니다. 이 표본에서는 B의 단가를 200으로 하기로 정했을 뿐이며, 첫 값이나 마지막 값이 원래 정답이라는 뜻은 아닙니다. 어느 단가가 맞는지는 업무 규칙이 정합니다.

## 잘못된 결과: 오류 없이 20이 나옴

주문표의 각 행에 아래 수식을 썼습니다.

```text
=VLOOKUP(B2,Lookup!$A$2:$B$7,2,FALSE)
=XLOOKUP(B2,Lookup!$A$2:$A$7,Lookup!$B$2:$B$7)
=COUNTIF(Lookup!$A$2:$A$7,B2)
```

| ID | Key | VLOOKUP | XLOOKUP | COUNTIF |
| --- | --- | --- | --- | --- |
| S1 | A | 10 | 10 | 1 |
| S2 | B | 20 | 20 | 2 |
| S3 | C | 30 | 30 | 1 |
| S4 | D | 40 | 40 | 1 |
| S5 | E | 50 | 50 | 1 |

키 B에서 `VLOOKUP`과 `XLOOKUP`은 모두 20을 돌려줬고 오류 셀은 없었습니다. 두 함수가 같은 첫 번째 일치 값을 고른 이 결과는 이번 실행에서 관찰한 값입니다. Microsoft 문서도 `XLOOKUP`이 처음 찾은 일치 항목을 반환하며, 기본 검색 방향이 처음 항목부터라고 설명합니다.

여기에 수량을 곱한 금액(`=C2*D2`)은 S1부터 10, 40, 90, 40, 100이었고 합계는 280입니다. S2의 금액은 수량 2에 단가 20을 곱한 40입니다.

## 왜 문제가 되는가

`VLOOKUP`의 `FALSE`는 정확히 일치하는 값을 찾으라는 뜻이고, 조회 값은 찾는 범위의 첫 번째 열에서 찾습니다. 같은 키가 둘 이상이어도 어느 행을 쓸지 묻지 않고 찾은 첫 값을 돌려줍니다. 오류가 아니므로 시트에 아무 표시도 남지 않습니다. 첫 번째 일치 값을 고르는 방식이므로 결과는 단가표의 행 순서에 기대게 됩니다. 정렬을 바꿔 가져오는 값이 달라지는지는 이번 실행에서 시험하지 않았습니다.

## 수정: 조회 전에 중복을 세고, 승인된 단가를 쓰기

첫 단계는 `COUNTIF`로 키마다 단가표에 몇 번 나오는지 세는 것입니다. 위 표의 `COUNTIF` 열이 그 값이고, B만 2였습니다.

두 번째 단계는 Power Query에서 단가표를 키로 묶어 2개 이상인 키만 남기는 것입니다.

```powerquery
let
    S = Excel.CurrentWorkbook(){[Name="Lookup"]}[Content],
    G = Table.Group(
        S,
        {"Key"},
        {
            {"Count", each Table.RowCount(_), Int64.Type},
            {"Minimum", each List.Min([Price]), type number},
            {"Maximum", each List.Max([Price]), type number}
        }
    )
in
    Table.SelectRows(G, each [Count] > 1)
```

결과는 한 행이었습니다. 키 B, 개수 2, 최솟값 20, 최댓값 200. 키가 같은데 최솟값과 최댓값이 다르면 단순 중복이 아니라 서로 다른 단가가 충돌하는 것이므로, 담당자가 하나를 정해야 합니다.

세 번째 단계는 정한 단가만 담은 표를 조회하는 것입니다. 이 표본에서는 `Approved` 표를 `VLOOKUP(B2,Approved!$A$2:$B$6,2,FALSE)`로 조회했고 승인 단가는 10, 200, 30, 40, 50이었습니다.

## 수정 후 결과와 대조

| ID | Quantity | 첫 일치 단가 금액 | 승인 단가 금액 |
| --- | --- | --- | --- |
| S1 | 1 | 10 | 10 |
| S2 | 2 | 40 | 400 |
| S3 | 3 | 90 | 90 |
| S4 | 1 | 40 | 40 |
| S5 | 2 | 100 | 100 |
| 합계 | | 280 | 640 |

두 합계의 차이는 360이고, 전부 S2에서 나옵니다. 중복 키는 1개였고, 그 한 키 때문에 금액 합계가 승인 기준보다 360 적게 나왔습니다. `XLOOKUP`은 문서상 검색 방향을 마지막 항목부터로 바꿀 수 있지만, 이번 실행에서는 기본 설정만 확인했습니다. 방향을 바꿔 다른 값을 가져오게 하는 것은 조회 결과를 바꿀 뿐, 어느 단가가 맞는지를 정해 주지는 않습니다.

## 내 파일에 적용하기 전 확인할 것

- 조회 범위의 키 열에 `COUNTIF`가 2 이상인 행이 있는지 먼저 찾습니다.
- 중복 키가 있으면 같은 키의 값들이 서로 같은지 확인합니다. 값이 다르면 어느 것을 쓸지 규칙을 정합니다.
- 조회 결과의 합계를 승인된 표 기준 합계와 따로 대조합니다.
- 단가표를 정렬하거나 새로 붙여 넣은 뒤에도 같은 점검을 다시 돌립니다.
- 키 앞뒤 공백이나 대소문자 차이로 같은 키가 둘로 갈라진 경우는 이 글에서 다루지 않았습니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![키 B의 첫 일치 단가 20과 중복 개수 2](/images/excel-lab/excel-duplicate-key-before-vlookup/before.png)

키 B의 첫 일치 단가 20과 중복 개수 2.

![ID·키별 승인 단가와 승인 금액](/images/excel-lab/excel-duplicate-key-before-vlookup/after.png)

ID·키별 승인 단가와 승인 금액.

## 이 글에서 확인한 범위

- Excel 16.0 빌드 20527, 한국어 UI 환경에서 합성 데이터로 실행한 결과입니다.
- 실행은 데스크톱 Excel을 자동화해 진행했습니다. 리본 메뉴의 클릭 경로는 이 글에 쓰지 않았고 확인하지도 않았습니다.
- 확인한 값: `VLOOKUP` 20, `XLOOKUP` 20, `COUNTIF` 2, 첫 일치 기준 합계 280, 승인 단가 기준 합계 640, 차이 360, Power Query 중복 키 결과 1행(B, 2, 20, 200).
- 확인하지 못한 것: `XLOOKUP`의 다른 검색 방향 설정, 다른 Excel 빌드와 다른 운영체제 언어 설정에서의 동작.
- 승인 단가 200은 표본에서 정한 값이며 실제 업무의 정답을 뜻하지 않습니다.
