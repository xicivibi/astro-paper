# Xici sign tool / Excel lab 검토 수정 — 2026-11-07

요청한 8개 지적은 실제 파일·회귀 테스트·Excel 실행으로 확인했다. 커밋, push, 배포, 이력 변경, 다른 에이전트 호출은 하지 않았다.

| 항목 | 확인 및 수정 결과 |
| --- | --- |
| 1. 개인정보 | 15개 case result에 프린터·프로세스 메타데이터가 남아 있었다. 디스크에서 printer·cleanup·retired_instances를 제거하고 cleanup_verified만 보존한다. verify_runs는 해당 비공개 키를 깊이에 관계없이 거부한다. owned-process.json은 git에서 제외된 로컬 안전 검사용이며 공개 키트 자원이 아니다. Python 캐시·Excel 잠금 파일도 제외했다. |
| 2. 서명자 | 누락된 모델 이름을 대소문자 구분 없이 차단하고 Unicode 단어 경계를 사용한다. Abbott·Agenta·김아이·Claudette·Hailey 등은 통과한다. privacyCheck에 실행 시 COMPUTERNAME을 추가했다. |
| 3. 발행일 | --date 생략 시 max(현재 시각, KST 오늘 09:00)에서 시작한다. 09:00 전후·자정·7일 경계 회귀 테스트 통과. |
| 4. 경로 | 평평한 C:\샘플\파일만 허용한다. ..·추가 구분자·드라이브 없는 Users·JSON 이중 역슬래시·공백 뒤 하위 경로를 검사한다. |
| 5. 이미지 공개 | public의 초안 PNG 26개를 제거했다. 본문 참조가 있으면 두 검증된 lab PNG를 글·키트와 함께 준비하고 성공 시 복사한다. dry-run 출력, kit-only, 누락/충돌 거부, 최종 글 이동 실패 시 원복을 테스트했다. |
| 6. 이미지 내용 | 아래 13편의 26장을 직접 보았다. 중복 키 after는 ID·Key·Quantity·ApprovedPrice·ApprovedAmount만 표시한다. 텍스트 숫자 before는 SUM 0과 #VALUE!를 표시한다. 두 사례의 정수 캡처 서식을 0으로 지정한 뒤 원래 서식을 복원해 관측 기록을 보존한다. 날짜 로캘 두 그림은 각 해석으로만 명명했다. |
| 7. 오타 | 14개 실험 초안의 범위 섹션을 검색했다. PDF·type-change·group-by와 추가 발견한 fill-down, 총 4편만 고쳤다. 13개 수정 글은 두 허용 섹션 밖의 내용이 유지됨을 비교했다. |
| 8. 인계 | 원본 백엔드 폴더를 명시하는 자리표시자와 그 폴더의 venv Python을 사용한다. frontend git common-dir로 backend 경로를 유추한 시도는 파일 존재 검사에서 실패해 제외했다. 검증 날짜·실제 수치·시각 선택·이미지 복사 동작을 오늘 결과로 갱신했다. |

수량 정정: cases는 15개다. 공개된 using-locale 1편과 unpivot 1편을 제외한 이미지 검토 대상은 13편이며 기존 public 이미지도 26장이다. 실험 초안은 unpivot을 포함해 14편이므로 서명 미리보기는 14편 모두 실행했다. unpivot에는 이미지 섹션/참조가 없어 원고를 수정하지 않았다.

## 실제 검증

- npm.cmd test: 156 통과, 0 실패(임시 off·verify·serve 빌드 포함).
- npm.cmd run lint: 종료 코드 0.
- node scripts/check-post-quality.mjs: 공개 6편, 오류 0, 기존 경고 7.
- python -m unittest discover -s lab/excel -p test_evidence.py: 8 통과.
- run-all -RunLabel first / second: 각각 15 통과, 0 실패.
- python lab/excel/verify_runs.py first second: 15 통과, 0 실패, 전체 비교 대상 관측·이미지 메타데이터 동일.
- 수정 전 기준선 대비: 15개 모두 관측값·수식/M·합계·검증 결과 동일. 변경된 캡처 메타데이터는 별도로 취급했다.
- verify_processes.ps1: 남은 자체 Excel 0개. 기존 Excel에는 연결하거나 종료하지 않았다.
- 실제 sign-post CLI: 초안 14편 + using-locale --kit-only, 15개 dry-run 모두 종료 코드 0. 실행 전후 후보 파일 해시 동일.
- git diff --check 통과. 공개 글 수·실제 서명 필드·배포 상태는 변경하지 않았다.

처음 캡처 검증에서는 General 서식 설정이 두 사례에서 거부됐다(전체 13 통과·2 실패). 정수 서식 0으로 수정하고 개별 통과를 확인한 뒤 위의 성공한 전체 실행 두 번을 새로 확보했다. 의도적인 거부 테스트는 AI 서명, 개인정보/경로, 누락·오래된 증거, 이미지 누락·충돌, 쓰기 실패를 포함한다.

## 이미지 대응

before/after는 파일명이며 항상 수정 전/후의 정답을 뜻하지 않는다. 표의 설명은 각 그림의 대체 텍스트와 한 줄 캡션이다.

| 사례 | before.png: 범위와 설명 | after.png: 범위와 설명 |
| --- | --- | --- |
| [csv-date-day-month-swap-checklist](../src/content/posts/csv-date-day-month-swap-checklist.md) | [before.png](../lab/excel/cases/csv-date-day-month-swap-checklist/before.png) `Q_us_audit!$A$1:$E$7` — en-US로 읽은 날짜와 오류 | [after.png](../lab/excel/cases/csv-date-day-month-swap-checklist/after.png) `Q_gb_audit!$A$1:$E$7` — en-GB로 읽은 날짜와 오류 |
| [csv-decimal-thousands-separator](../src/content/posts/csv-decimal-thousands-separator.md) | [before.png](../lab/excel/cases/csv-decimal-thousands-separator/before.png) `Q_us_audit!$A$1:$F$7` — 전체 열을 en-US로 읽은 숫자와 오류 | [after.png](../lab/excel/cases/csv-decimal-thousands-separator/after.png) `Q_fixed!$A$1:$D$7` — 행별 SourceLocale을 적용한 숫자 |
| [csv-export-personal-data-column-check](../src/content/posts/csv-export-personal-data-column-check.md) | [before.png](../lab/excel/cases/csv-export-personal-data-column-check/before.png) `full-export!$A$1:$E$6` — 숨긴 열을 펼친 합성 연락처 포함 원본 | [after.png](../lab/excel/cases/csv-export-personal-data-column-check/after.png) `allowlist-export!$A$1:$B$6` — ID와 Amount만 복사한 허용 열 시트 |
| [csv-quoted-newline-row-break](../src/content/posts/csv-quoted-newline-row-break.md) | [before.png](../lab/excel/cases/csv-quoted-newline-row-break/before.png) `Q_none!$A$1:$C$8` — QuoteStyle.None에서 7행으로 갈라진 결과 | [after.png](../lab/excel/cases/csv-quoted-newline-row-break/after.png) `Q_query!$A$1:$C$6` — 기본 Csv.Document로 5행을 유지한 결과 |
| [excel-duplicate-key-before-vlookup](../src/content/posts/excel-duplicate-key-before-vlookup.md) | [before.png](../lab/excel/cases/excel-duplicate-key-before-vlookup/before.png) `Input!$A$1:$F$6` — 키 B의 첫 일치 단가 20과 중복 개수 2 | [after.png](../lab/excel/cases/excel-duplicate-key-before-vlookup/after.png) `ApprovedResult!$A$1:$E$6` — ID·키별 승인 단가와 승인 금액 |
| [excel-pdf-export-print-area-check](../src/content/posts/excel-pdf-export-print-area-check.md) | [before.png](../lab/excel/cases/excel-pdf-export-print-area-check/before.png) `Input!$A$1:$F$7` — A:F 인쇄 영역이 두 페이지로 나뉜 결과 | [after.png](../lab/excel/cases/excel-pdf-export-print-area-check/after.png) `Input!$A$1:$R$7` — A:R 전체 18열을 한 페이지 너비에 맞춘 결과 |
| [excel-text-stored-numbers-convert](../src/content/posts/excel-text-stored-numbers-convert.md) | [before.png](../lab/excel/cases/excel-text-stored-numbers-convert/before.png) `Conversions!$A$1:$D$9` — 텍스트 원본 SUM 0과 VALUE·이중 단항의 오류 | [after.png](../lab/excel/cases/excel-text-stored-numbers-convert/after.png) `Q_fixed!$A$1:$B$7` — NBSP 정리 후 S4가 1234로 변환된 결과 |
| [power-query-fill-down-merged-cells](../src/content/posts/power-query-fill-down-merged-cells.md) | [before.png](../lab/excel/cases/power-query-fill-down-merged-cells/before.png) `Q_query!$A$1:$C$7` — 병합 셀을 읽은 뒤 Group에 남은 빈 칸 | [after.png](../lab/excel/cases/power-query-fill-down-merged-cells/after.png) `Q_fixed!$A$1:$D$7` — Group·LiteralEmpty 채우기 후에도 남은 Note 빈 칸 |
| [power-query-group-by-subtotal](../src/content/posts/power-query-group-by-subtotal.md) | [before.png](../lab/excel/cases/power-query-group-by-subtotal/before.png) `Q_query!$A$1:$D$4` — 텍스트 혼합으로 B의 Sum이 빈 칸인 결과 | [after.png](../lab/excel/cases/power-query-group-by-subtotal/after.png) `Q_fixed!$A$1:$D$4` — 숫자형 변환 후 B의 Sum이 25인 결과 |
| [power-query-merge-key-whitespace](../src/content/posts/power-query-merge-key-whitespace.md) | [before.png](../lab/excel/cases/power-query-merge-key-whitespace/before.png) `Q_query!$A$1:$D$8` — 정리 전 7행 중 2행만 일치한 결과 | [after.png](../lab/excel/cases/power-query-merge-key-whitespace/after.png) `Q_fixed!$A$1:$C$8` — 공백 정리 후 5행 일치·2행 불일치 결과 |
| [power-query-refresh-file-path-error](../src/content/posts/power-query-refresh-file-path-error.md) | [before.png](../lab/excel/cases/power-query-refresh-file-path-error/before.png) `Q_diagnostics!$A$1:$B$2` — 파일 이름 변경 후 DataSource.NotFound 진단 | [after.png](../lab/excel/cases/power-query-refresh-file-path-error/after.png) `Q_fixed!$A$1:$B$6` — 새 경로 적용 후 ID·Amount 5행을 읽은 결과 |
| [power-query-split-column-delimiter](../src/content/posts/power-query-split-column-delimiter.md) | [before.png](../lab/excel/cases/power-query-split-column-delimiter/before.png) `Q_query!$A$1:$D$7` — 고정 3열 분할에서 S6의 Q가 빠진 결과 | [after.png](../lab/excel/cases/power-query-split-column-delimiter/after.png) `Q_dynamic!$A$1:$E$7` — 동적 4열 분할에서 S6의 Q를 보존한 결과 |
| [power-query-type-change-error-rows](../src/content/posts/power-query-type-change-error-rows.md) | [before.png](../lab/excel/cases/power-query-type-change-error-rows/before.png) `Q_query!$A$1:$B$7` — 숫자형 Code의 선행 0 소실과 Amount 빈 칸 | [after.png](../lab/excel/cases/power-query-type-change-error-rows/after.png) `Q_fixed!$A$1:$B$7` — 텍스트형 Code의 선행 0 보존과 Amount 빈 칸 |
| [power-query-unpivot-monthly-columns](../src/content/posts/power-query-unpivot-monthly-columns.md) | [before.png](../lab/excel/cases/power-query-unpivot-monthly-columns/before.png) `Q_selected!$A$1:$F$59` — 본문 참조 없음·이미지 직접 검토 제외 | [after.png](../lab/excel/cases/power-query-unpivot-monthly-columns/after.png) `Q_query!$A$1:$E$65` — 본문 참조 없음·이미지 직접 검토 제외 |

## 도구와 남은 항목

| 도구·후보 | 상태·선정 근거 |
| --- | --- |
| Windows PowerShell / Excel COM | 기존 설치·로컬 호출·실제 검증. 숨김 신규 인스턴스, PID+시작 시각 소유권 확인, 기존 Excel 보존 규칙 재사용. |
| Python / PyMuPDF / Pillow | 기존 설치·로컬 호출·실제 검증. 네이티브 PDF 이미지화·관측 비교·XLSX 내부 검사 재사용. |
| Node 내장 fs·crypto·zlib / node:test / ESLint / Prettier | 기존 설치·호출·검증. 기존 트랜잭션·게이트·테스트를 확장했다. |
| Excel add-in / Sheets·Drive 커넥터 / artifact workbook 도구 | 연결 여부를 검사하지 않았다. 명시된 네이티브 Excel 실험을 대체할 수 없어 제외. |
| 새 ZIP·YAML 패키지 / pywin32 / Vitest | 추가 설치·결제 없이 기존 표준 라이브러리·PowerShell·테스트로 충분해 제외. |
| 외부 모델·에이전트·게시·배포 도구 | 요청 범위에서 제외. 호출하지 않음. |

남은 항목은 기존 품질 게이트 경고 7건과 실제 사람의 검토·서명이다. 공개 시점은 서명과 별도로 정적 사이트를 다시 빌드·배포하는 시점에 달려 있다. 새 키트와 서명 후 복사한 이미지는 예약 글보다 먼저 다음 배포 묶음에 포함될 수 있다. 이번 작업은 실제 서명이나 외부 배포를 하지 않았다.

## 개인정보 스캔

현재 tracked 또는 non-ignored 후보 파일 **273개**, 압축 내부 항목 **188개**를 검사해 **일치 0·읽기 실패 0**이다. 검사 시점의 환경 변수 COMPUTERNAME·USERNAME, 로컬 프린터 이름/모델과 현재 owned-process.json의 PID를 메모리에서 읽었다. 값 자체는 파일이나 보고서에 기록하지 않았다. 삭제한 public 이미지 26개는 현재 파일이 없어 검사 대상에서 빠지며, git 이력 정리는 conductor의 범위다. 초기 스캔은 case result 15개에서 프린터·PID를, 새로 생성된 Python 캐시 4개에서 로컬 사용자 경로를 탐지했다. 결과 메타데이터 제거와 캐시 제외 후 위의 최종 검사를 통과했다.
