---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T22:48:37+09:00
title: "숨긴 열도 CSV에 그대로 저장됩니다: 개인정보 열을 빼고 내보내는 허용 열 방식"
draft: true
topic: "excel-csv"
tags:
  - "csv"
  - "개인정보"
  - "excel"
  - "열 숨기기"
  - "내보내기"
description: "Excel에서 열을 숨기고 CSV로 저장해도 숨긴 열이 파일에 남는 것을 합성 데이터로 재현하고, 허용 열만 옮긴 시트로 내보내 합계를 대조하는 절차를 정리합니다."
aiAssisted: true
sources:
  - "https://support.microsoft.com/en-us/office/hide-or-show-rows-or-columns-659c2cad-802e-44ee-a614-dde8443579f8"
  - "https://support.microsoft.com/en-us/office/save-a-workbook-in-another-file-format-6a16c862-4a36-48f9-a300-c2ca0065286e"
  - "https://support.microsoft.com/en-us/office/import-or-export-text-txt-or-csv-files-5250ac4c-663c-47ce-937b-339e391393ba"
  - "https://learn.microsoft.com/en-us/office/vba/api/excel.xlfileformat"
testingStatus: not_tested
---

외부에 넘길 CSV를 만들 때 이름, 이메일, 전화번호 열은 숨기기만 하면 빠진다고 생각하기 쉽습니다. 화면에서는 열이 보이지 않으니까요. 이 글은 가상의 개인정보 열 세 개를 숨긴 시트를 CSV로 저장해 숨긴 열이 파일에 어떻게 되는지 확인하고, 허용한 열만 따로 옮긴 시트로 내보내는 방식과 결과를 대조한 기록입니다. 데이터는 모두 지어낸 값입니다.

## 표본 데이터

`Input` 시트는 5행이고 열은 다섯 개입니다. 이름과 이메일, 전화번호에 해당하는 `FakeName`, `FakeEmail`, `FakePhone` 열은 실제 사람의 정보가 아닌 합성 값입니다.

| ID | FakeName | FakeEmail | FakePhone | Amount |
| --- | --- | --- | --- | --- |
| S1 | INVENTED PERSON 1 | fake1@example.invalid | 000-0000-0001 | 10 |
| S2 | INVENTED PERSON 2 | fake2@example.invalid | 000-0000-0002 | 20 |
| S3 | INVENTED PERSON 3 | fake3@example.invalid | 000-0000-0003 | 30 |
| S4 | INVENTED PERSON 4 | fake4@example.invalid | 000-0000-0004 | 40 |
| S5 | INVENTED PERSON 5 | fake5@example.invalid | 000-0000-0005 | 50 |

별도의 숨김 시트도 하나 만들었습니다. 이 시트에는 `INVENTED_HIDDEN_SHEET_ONLY`라는 표식 값을 넣어 두었고, 내보낸 CSV에 이 표식이 들어가는지를 확인하는 용도입니다.

## 잘못된 결과: 숨긴 열이 파일에 남음

`FakeName`, `FakeEmail`, `FakePhone`이 있는 `B:D` 열을 숨기고, 표식이 든 시트는 숨김 시트로 바꾼 뒤 `Input` 시트를 활성 상태에서 CSV(UTF-8, 파일 형식 값 `xlCSVUTF8`)로 저장했습니다. 저장된 파일 내용은 다음과 같았습니다.

```text
ID,FakeName,FakeEmail,FakePhone,Amount
S1,INVENTED PERSON 1,fake1@example.invalid,000-0000-0001,10
S2,INVENTED PERSON 2,fake2@example.invalid,000-0000-0002,20
S3,INVENTED PERSON 3,fake3@example.invalid,000-0000-0003,30
S4,INVENTED PERSON 4,fake4@example.invalid,000-0000-0004,40
S5,INVENTED PERSON 5,fake5@example.invalid,000-0000-0005,50
```

숨긴 열 값은 모두 파일에 들어 있었습니다. 결과는 5열, 5행(머리글 제외)이었습니다. 반면 다른 시트의 표식 `INVENTED_HIDDEN_SHEET_ONLY`는 파일에 없었습니다. 이 파일을 Excel에서 다시 열어 읽은 값도 같은 5열이었습니다.

## 왜 그런가

열 숨기기는 화면에서 열을 감추는 기능입니다. Microsoft 문서도 숨긴 열이 이중선으로 표시되고 `숨기기 취소`로 다시 볼 수 있다고 설명합니다. 값이 지워지는 것은 아닙니다. 이번 실행에서는 숨긴 열의 값이 저장 파일에 그대로 기록됐습니다.

한편 숨김 시트의 표식이 나오지 않은 이유는 Microsoft 문서의 설명과 맞습니다. 문서에 따르면 CSV(쉼표로 분리) 형식은 활성 시트만 저장합니다. 이 실행에서는 `Input` 시트가 활성 상태였고 표식이 있는 시트는 활성이 아니었습니다. 숨김 시트 자체를 활성으로 만들어 저장하는 경우는 시험하지 않았습니다.

## 수정: 허용 열만 옮긴 시트로 내보내기

숨길 열을 고르는 대신, 내보내도 되는 열의 목록을 먼저 정하고 그 열만 새 시트에 값으로 옮겼습니다. 이 표본에서 허용한 열은 `ID`와 `Amount` 두 개였습니다. 그 시트를 활성으로 두고 같은 형식(`xlCSVUTF8`)으로 저장한 파일은 다음과 같습니다.

```text
ID,Amount
S1,10
S2,20
S3,30
S4,40
S5,50
```

저장 파일을 다시 열어 읽은 결과는 2열, 5행이었습니다. 합성 이메일 값은 파일에 포함되지 않았고, 숨김 시트의 표식도 없었습니다.

## 결과 대조

| 항목 | 숨긴 열 상태로 저장 | 허용 열 시트로 저장 |
| --- | --- | --- |
| 열 수 | 5 | 2 |
| 데이터 행 수 | 5 | 5 |
| `Amount` 합계 | 150 | 150 |
| 합성 이메일 값 포함 | 포함 | 없음 |
| 숨김 시트 표식 포함 | 없음 | 없음 |

행 수와 `Amount` 합계가 같으므로 열을 줄였을 뿐 레코드가 사라지지 않았음을 확인할 수 있습니다. 허용 목록 방식은 새 열이 원본에 추가되어도 목록에 없으면 내보내지 않는다는 점이 숨기기와 다릅니다. 다만 이 글에서는 열을 추가하는 경우는 시험하지 않았습니다.

## 내 파일에 적용하기 전 확인할 것

- 저장한 CSV를 메모장 같은 텍스트 편집기로 열어 머리글 줄에 어떤 열이 있는지 직접 확인합니다.
- 내보내도 되는 열의 목록을 먼저 적어 두고, 그 열만 새 시트에 값으로 옮깁니다.
- 새 시트를 활성으로 둔 상태에서 저장했는지 확인합니다. 저장 형식은 활성 시트만 담습니다.
- 원본과 내보낸 파일의 행 수와 숫자 열 합계를 대조합니다.
- 이름, 연락처뿐 아니라 메모 열, 자유 입력 열에 개인정보가 섞여 있지 않은지 값을 훑어봅니다.
- 이 글의 합성 데이터와 달리 실제 파일은 저장 전에 담당 부서의 개인정보 처리 기준을 따릅니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![숨긴 열을 펼친 합성 연락처 포함 원본](/images/excel-lab/csv-export-personal-data-column-check/before.png)

숨긴 열을 펼친 합성 연락처 포함 원본.

![ID와 Amount만 복사한 허용 열 시트](/images/excel-lab/csv-export-personal-data-column-check/after.png)

ID와 Amount만 복사한 허용 열 시트.

## 이 글에서 확인한 범위

- Excel 16.0 빌드 20527, 한국어 UI 환경에서 합성 데이터로 실행한 결과입니다. 실제 개인정보는 사용하지 않았습니다.
- 실행은 데스크톱 Excel을 자동화해 진행했습니다. 리본 메뉴의 클릭 경로는 이 글에 쓰지 않았고 확인하지도 않았습니다.
- 확인한 값: 숨긴 열 상태 CSV 5열·5행, 숨긴 열 값 포함, 숨김 시트 표식 미포함, 허용 열 CSV 2열·5행, 양쪽 `Amount` 합계 150.
- 확인하지 못한 것: 숨긴 행의 저장 동작, 다른 CSV 형식(쉼표 구분 비UTF-8 등), 다른 Excel 빌드와 다른 운영체제 언어 설정에서의 동작.
- 이 글은 개인정보 보호 요건을 충족한다는 보증이 아닙니다. 내보내기 전 열 목록을 직접 점검하는 방법만 다룹니다.
