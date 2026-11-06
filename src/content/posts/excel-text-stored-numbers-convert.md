---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T23:16:31+09:00
title: "텍스트 숫자 합계가 0이 될 때: VALUE가 #VALUE!를 내는 비분리 공백 정리"
draft: true
topic: "excel-csv"
tags:
  - "excel"
  - "텍스트 숫자"
  - "VALUE"
  - "Power Query"
  - "비분리 공백"
description: "텍스트로 저장된 수량 열의 SUM이 0이 되고 VALUE가 #VALUE!를 내는 원인을 6행 표본으로 재현하고, 공백 정리 후 합계 1334로 대조합니다."
aiAssisted: true
sources:
  - "https://support.microsoft.com/en-us/office/convert-numbers-stored-as-text-to-numbers-40105f2a-fe79-4477-a171-c5bad0f0a885"
  - "https://support.microsoft.com/en-us/office/value-function-257d0108-07dc-437d-ae1c-bc2d3953d8c2"
  - "https://support.microsoft.com/en-us/office/trim-function-410388fa-c5df-49c6-b16c-9e5630b479f9"
  - "https://support.microsoft.com/en-us/office/clean-function-26f3d7c5-475f-4a9c-90e5-4b8ba987ba41"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-trim"
  - "https://learn.microsoft.com/en-us/powerquery-m/text-replace"
  - "https://learn.microsoft.com/en-us/powerquery-m/table-transformcolumntypes"
testingStatus: not_tested
---

수량 열에 숫자처럼 보이는 값이 들어 있는데 `SUM`이 0을 돌려주는 경우가 있습니다. 열 전체가 텍스트로 저장되어 있기 때문입니다. 그래서 `VALUE`나 `--` 같은 변환 수식을 얹었더니 일부 행에서는 `#VALUE!`가 나오고, 같은 열을 Power Query에서 숫자 형식으로 바꾸면 한 행이 말없이 비어 버리는 일이 있습니다. 이 글은 6행짜리 합성 표본으로 이 세 가지를 나란히 놓고, 원인이 된 공백 문자를 정리한 뒤 합계를 대조하는 과정을 기록합니다.

## 표본 데이터

`Amount` 열은 전부 텍스트입니다. 눈으로는 구분하기 어렵지만 공백의 종류가 다릅니다.

| ID | Amount (저장된 텍스트) | 설명 |
| --- | --- | --- |
| S1 | `10` | 공백 없음 |
| S2 | `␠20␠` | 앞뒤에 일반 공백(U+0020) |
| S3 | `␣30␣` | 앞뒤에 비분리 공백(U+00A0, NBSP) |
| S4 | `1␣234` | 천 단위 자리에 비분리 공백 |
| S5 | `0` | 공백 없음 |
| S6 | `40` | 공백 없음 |

여기서 `␠`는 일반 공백, `␣`는 비분리 공백을 뜻하는 표기입니다. 의도한 수량 합계는 10+20+30+1234+0+40으로 1334입니다.

## 잘못된 결과: SUM 0, VALUE 실패

텍스트 상태의 `Amount` 열에 `SUM`을 적용하면 0이었습니다. 텍스트로 저장된 값은 합계에 들어가지 않기 때문에 오류도 없이 0이 나옵니다.

변환 수식 두 가지(`=VALUE(B2)`, `=--B2`)를 행마다 적용한 결과는 다음과 같았습니다.

| ID | VALUE | `--` |
| --- | --- | --- |
| S1 | 10 | 10 |
| S2 | 20 | 20 |
| S3 | `#VALUE!` | `#VALUE!` |
| S4 | `#VALUE!` | `#VALUE!` |
| S5 | 0 | 0 |
| S6 | 40 | 40 |

일반 공백이 붙은 S2는 변환이 됐고, 비분리 공백이 붙은 S3와 S4는 두 수식 모두 오류였습니다. 이 결과는 이번 빌드와 이 표본에서 관찰한 값입니다.

## 왜 그런가

Microsoft 문서에 따르면 `TRIM` 함수는 7비트 ASCII 공백(값 32)을 지우도록 설계되어 있고, 값이 160인 비분리 공백은 그것만으로는 제거하지 않습니다. 웹 페이지나 외부 시스템에서 가져온 데이터에 이 문자가 자주 섞입니다. `CLEAN`은 출력되지 않는 문자를 제거하는 함수이므로 비분리 공백을 지우는 용도는 아닙니다. 그래서 비분리 공백은 `SUBSTITUTE`로 직접 지정해 바꿔야 합니다.

## 수정: 공백을 정리한 뒤 변환하기

워크시트 수식은 `CLEAN`, `TRIM`으로 일반 공백과 제어 문자를 정리하고, `SUBSTITUTE`로 비분리 공백(`UNICHAR(160)`)을 지운 뒤 `VALUE`를 적용했습니다.

```text
=VALUE(SUBSTITUTE(TRIM(CLEAN(B2)),UNICHAR(160),""))
```

결과는 S1부터 S6까지 10, 20, 30, 1234, 0, 40이었고, 합계는 1334였습니다.

Power Query에서는 열을 숫자 형식으로 바꾸기 전에 같은 정리를 먼저 적용했습니다. 먼저 정리 없이 형식만 바꾼 쿼리입니다.

```powerquery
Table.TransformColumnTypes(
    Excel.CurrentWorkbook(){[Name="Input"]}[Content],
    {{"Amount", type number}},
    "en-US"
)
```

이 쿼리의 로드 결과는 S1 10, S2 20, S3 30, S4 빈 값, S5 0, S6 40이었습니다. 새로고침은 오류 없이 끝났고 시트에서도 오류 셀은 발견되지 않았습니다. S3는 정리 없이도 숫자가 됐지만, S4의 1234만 말없이 사라졌습니다. 오류 표시가 없으니 합계만 보고는 알아채기 어렵습니다.

정리를 먼저 적용한 쿼리는 다음과 같습니다.

```powerquery
let
    S = Table.TransformColumns(
        Excel.CurrentWorkbook(){[Name="Input"]}[Content],
        {{"Amount",
          each Text.Replace(Text.Trim(Text.Clean(_)), Character.FromNumber(160), ""),
          type text}}
    )
in
    Table.TransformColumnTypes(S, {{"Amount", type number}}, "en-US")
```

`Text.Trim`은 기본값으로 앞뒤 공백 문자를 지우고, `Text.Replace`는 지정한 문자열을 바꿉니다. `Character.FromNumber(160)`으로 비분리 공백을 직접 지정했습니다. 로드 결과는 10, 20, 30, 1234, 0, 40이었습니다.

## 결과 대조

| 방법 | 합계 또는 결과 |
| --- | --- |
| 텍스트 원본에 `SUM` | 0 |
| 공백 정리 후 워크시트 수식 | 1334 |
| 공백 정리 후 Power Query | 1334 (6행 모두 숫자) |
| 정리 없이 형식만 변경한 Power Query | S4가 빈 값 |

의도한 합계 1334와 워크시트 결과, Power Query 결과가 서로 같았습니다. 변환이 끝나면 합계뿐 아니라 숫자가 아닌 행이 남지 않았는지도 함께 확인하세요.

## 텍스트 나누기로 바꾸면 일부 행이 남습니다

같은 열에 텍스트 나누기(구분 기호 방식, 열 서식 `일반`)를 적용한 결과도 기록했습니다. S1, S2, S5, S6은 숫자가 됐고 S3(`␣30␣`)과 S4(`1␣234`)는 텍스트로 남았습니다. 이 상태의 합계는 70이었습니다. 10+20+0+40의 값입니다. 일괄 변환 기능을 쓴 뒤에도 합계가 의도한 값과 다르면 남은 텍스트 행이 있다는 뜻입니다.

## 내 파일에 적용하기 전 확인할 것

- 변환 전에 `SUM`과 `COUNT`(숫자만 세는 함수)를 비교해 텍스트 행이 몇 개인지 확인합니다.
- 변환 후 합계가 의도한 값과 같은지 별도 계산과 대조합니다.
- 일반 공백과 비분리 공백이 섞여 있을 수 있으므로 `TRIM`만 쓰지 않습니다.
- `VALUE` 결과에서 `#VALUE!`가 나온 행은 값을 직접 열어 공백 외 다른 문자가 있는지 봅니다.
- Power Query에서는 형식 변경 후 빈 값이 된 행이 없는지 행 수와 합계로 확인합니다.
- 선행 0이 의미 있는 식별자(주문 번호 등)에는 이 변환을 적용하지 않습니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![텍스트 원본 SUM 0과 VALUE·이중 단항의 오류](/images/excel-lab/excel-text-stored-numbers-convert/before.png)

텍스트 원본 SUM 0과 VALUE·이중 단항의 오류.

![NBSP 정리 후 S4가 1234로 변환된 결과](/images/excel-lab/excel-text-stored-numbers-convert/after.png)

NBSP 정리 후 S4가 1234로 변환된 결과.

## 이 글에서 확인한 범위

- Excel 16.0 빌드 20527, 한국어 UI 환경에서 합성 데이터로 실행한 결과입니다.
- 실행은 데스크톱 Excel을 자동화해 진행했습니다. 리본 메뉴의 클릭 경로는 확인하지 않았습니다.
- 확인한 값: 텍스트 상태 `SUM` 0, 워크시트 정리 후 합계 1334, Power Query 정리 후 합계 1334, 텍스트 나누기 후 합계 70.
- 확인하지 못한 것: 다른 Excel 빌드와 다른 운영체제 언어 설정에서의 동작.
- 셀 왼쪽 위 녹색 삼각형이 이 표본에서 표시되는지는 확인하지 않았습니다. Microsoft 문서에는 해당 오류 표시 메뉴에서 숫자로 변환하는 방법이 안내되어 있습니다.
- 이 글의 표본 데이터에서 숫자와 공백 위치가 다르면 결과도 달라질 수 있습니다.
