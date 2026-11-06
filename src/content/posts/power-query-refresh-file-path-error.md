---
author: "직장인 자동화 실험실"
pubDatetime: 2026-11-06T22:51:36+09:00
title: "파일을 옮긴 뒤 Power Query 새로고침이 DataSource.NotFound로 멈출 때"
draft: true
topic: "excel-csv"
tags:
  - "power query"
  - "excel"
  - "csv"
  - "파일 경로"
  - "새로고침 오류"
description: "CSV 파일을 옮긴 뒤 나타나는 DataSource.NotFound 오류를 재현하고, 경로를 이름 정의 셀로 빼서 5행을 다시 읽어 오는 M 코드를 보여 줍니다."
aiAssisted: true
sources:
  - "https://learn.microsoft.com/en-us/powerquery-m/file-contents"
  - "https://learn.microsoft.com/en-us/powerquery-m/excel-currentworkbook"
  - "https://learn.microsoft.com/en-us/powerquery-m/csv-document"
  - "https://learn.microsoft.com/en-us/powerquery-m/m-spec-error-handling"
  - "https://learn.microsoft.com/en-us/power-query/connectors/text-csv"
testingStatus: not_tested
---

폴더를 정리하거나 파일 이름을 바꾼 뒤 통합 문서를 열어 새로고침하면 쿼리가 멈추는 경우가 있습니다. 이 글은 CSV를 원본으로 쓰는 쿼리에서 파일을 옮겼을 때 어떤 오류가 나는지 기록하고, 경로를 셀 하나로 분리해 고치는 방법을 정리합니다.

## 표본 데이터와 처음 쿼리

원본은 `source.csv`이고 내용은 다섯 행입니다.

| ID | Amount |
| --- | --- |
| S1 | 10 |
| S2 | 20 |
| S3 | 30 |
| S4 | 40 |
| S5 | 50 |

쿼리에는 파일 경로를 코드 안에 그대로 적었습니다. 아래 경로는 글에 맞게 `C:\샘플\source.csv`로 줄여 적었습니다.

```powerquery
let
    S = Csv.Document(File.Contents("C:\샘플\source.csv"),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv])
in
    Table.PromoteHeaders(S, [PromoteAllScalars=true])
```

파일이 제자리에 있을 때 이 쿼리는 5행을 읽었습니다. `Amount` 값은 `10`부터 `50`까지 텍스트로 들어왔는데, 이 쿼리에는 열 형식을 바꾸는 단계가 없기 때문입니다. 숫자로 쓰려면 형식 변경 단계를 따로 추가해야 합니다.

## 파일을 옮긴 뒤의 새로고침

통합 문서를 저장하고 닫은 다음 `source.csv`를 다른 이름과 위치(`moved-source.csv`)로 옮기고 통합 문서를 다시 열어 새로고침했습니다. 쿼리는 1개 그대로 남아 있었고 새로고침은 다음 오류로 실패했습니다.

```text
[DataSource.NotFound] File or Folder: 'C:\샘플\source.csv' 파일을 찾을 수 없습니다.
```

경로는 위 샘플 경로로 줄였고 나머지는 기록된 그대로입니다. 결과 표는 로드되지 않았습니다. 오류 메시지는 앞부분이 영어, 뒷부분이 한국어로 섞여 나왔습니다. 이 한국어 문구는 이 환경에서 관측한 표시입니다.

같은 파일을 `try`로 감싸서 오류 내용을 표로 받아 보았습니다.

```powerquery
let
    T = try Binary.Length(Binary.Buffer(File.Contents("C:\샘플\source.csv")))
in
    #table({"HasError", "Reason", "Message", "Detail"},
        {{T[HasError],
          if T[HasError] then T[Error][Reason] else null,
          if T[HasError] then T[Error][Message] else null,
          if T[HasError]
              then (try Text.From(T[Error][Detail])
                    otherwise Text.FromBinary(Json.FromValue(T[Error][Detail]), TextEncoding.Utf8))
              else null}})
```

결과는 `HasError`가 TRUE, `Reason`이 `DataSource.NotFound`였고, `Detail`에는 찾지 못한 경로가 들어 있었습니다. 메시지만 봐도 되지만, 이 표로 받으면 사유를 `Reason`으로 구분해 처리할 수 있습니다.

## 고치는 방법: 경로를 이름 정의 셀로 분리

경로를 코드에 넣지 않고 통합 문서의 한 셀에 적은 뒤, 그 셀에 `SourcePath`라는 이름을 붙입니다. `Excel.CurrentWorkbook`은 통합 문서의 표와 이름 정의 범위를 읽어 줍니다. 쿼리는 이 셀에서 경로를 읽습니다.

```powerquery
let
    P = Excel.CurrentWorkbook(){[Name="SourcePath"]}[Content]{0}[Column1],
    S = Csv.Document(File.Contents(P),
        [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv])
in
    Table.PromoteHeaders(S, [PromoteAllScalars=true])
```

이 실행에서 단일 셀에 이름을 붙이면 `Column1`이라는 한 열짜리 표로 읽혔습니다. 셀에는 옮긴 파일의 경로를 적었습니다. 새로고침 결과는 5행, `S1`부터 `S5`까지 `Amount` 값 `10`, `20`, `30`, `40`, `50`이었습니다.

## 대조

고치기 전 5행, 고친 뒤 5행으로 행 수가 같고 값도 같았습니다. 이후 파일을 또 옮기면 쿼리를 열지 않고 `SourcePath` 셀의 경로만 바꾸면 됩니다.

## 점검표

- 오류 메시지에 `[DataSource.NotFound]`가 있는지, 뒤에 적힌 경로가 실제 파일 위치인지 봅니다.
- 쿼리 안에 절대 경로가 박혀 있는지 확인합니다.
- 자주 옮기는 파일이면 경로를 셀로 분리하고, 그 셀의 경로 오타와 끝에 붙은 공백도 점검합니다.
- 새로고침 뒤에는 행 수를 원본과 비교합니다.
- 숫자로 써야 하는 열은 읽은 뒤 형식을 따로 바꿉니다.

## 실제 Excel 결과

아래는 위 사례를 Excel에서 실행한 시트를 그대로 PDF로 내보내 이미지로 만든 것입니다.

![파일 이름 변경 후 DataSource.NotFound 진단](/images/excel-lab/power-query-refresh-file-path-error/before.png)

파일 이름 변경 후 DataSource.NotFound 진단.

![새 경로 적용 후 ID·Amount 5행을 읽은 결과](/images/excel-lab/power-query-refresh-file-path-error/after.png)

새 경로 적용 후 ID·Amount 5행을 읽은 결과.

## 이 글에서 확인한 범위

- Windows 데스크톱 Excel 16.0, 빌드 20527, 한국어 UI에서 합성 CSV로 실행했습니다. 쿼리 실행과 새로고침은 데스크톱 Excel을 자동화해 진행했습니다.
- 실행 중 Excel이 열린 상태에서는 운영 체제가 파일 이름 바꾸기를 막았고, 통합 문서를 닫은 뒤에도 CSV가 한동안 열려 있었습니다. 그래서 파일을 옮길 때는 실행 중이던 Excel을 종료하고 새로 열었습니다.
- 확인하지 못한 것: 한국어 리본 메뉴의 클릭 경로, 다른 Excel 빌드와 운영 체제 로캘, 네트워크 폴더와 SharePoint 경로, 통합 문서 안에서 쿼리 대화 상자로 경로를 바꾸는 방법.
- 오류 메시지의 한국어 문구는 이 로캘에서 관측한 것이며 다른 환경에서는 다를 수 있습니다.
