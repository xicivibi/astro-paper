---
author: "직장인 자동화 실험실"
pubDatetime: 2026-10-24T21:00:00+09:00
title: "CSV 날짜가 월일 순서로 뒤집힐 때 확인 순서"
draft: true
topic: "excel-csv"
tags:
  - "excel"
  - "csv"
  - "날짜 변환"
description: "날짜 형식이 정해지지 않은 CSV를 가져올 때 원본을 보존하고 로캘을 명시하는 절차입니다."
aiAssisted: true
sources:
  - "https://support.microsoft.com/excel"
  - "https://support.microsoft.com/en-us/excel/set-a-locale-or-region-for-data-power-query"
testingStatus: not_tested
---

> **소유자 재현 필요**: 이 초안은 AI 보조로 작성됐고 아직 아무도 실행해 보지 않았습니다. `public/reproduction/csv-date-day-month-swap-checklist/pending/`의 합성 입력으로 절차를 직접 따라 하고, 결과와 화면, 경험 문단을 채운 뒤에만 `testingStatus`와 서명 필드를 바꾸세요.

## 원본 날짜 형식부터 확인합니다

파일 제공자에게 형식을 확인합니다. (소유자 확인 필요)

## 가져오기에서 로캘을 지정합니다

1. 데이터 > 텍스트/CSV에서를 선택합니다.

## 결과를 원본과 대조합니다

expected/result.json과 비교합니다.

## 이 글의 확인 범위

이 초안은 아직 실행하지 않았습니다.
