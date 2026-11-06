# Xici 게시글 작성 템플릿

이 템플릿은 `src/content/posts/`에 새 글을 추가할 때 사용합니다. 메타데이터는 독자가 작성 방식과 확인 범위를 이해하도록 돕지만, 값을 입력했다고 해서 자동으로 사실 검증이 완료되는 것은 아닙니다.

```yaml
---
author: "작성자 이름"
pubDatetime: 2026-09-19T09:00:00+09:00
title: "독자가 바로 이해할 수 있는 제목"
draft: true
editorialStatus: published
topic: "excel-csv" # excel-csv | google-sheets-apps-script | docs-web-work
tags:
  - "주제"
description: "검색 결과와 공유 화면에 사용할 한두 문장 요약"
aiAssisted: true
lastReviewed: 2026-09-19T09:00:00+09:00
# 소유자가 글을 다시 읽은 뒤 직접 채웁니다. 도구·AI는 이 두 줄을 채우지 않습니다.
humanReviewedBy: ""
humanReviewedAt:
sources:
  - "https://example.com/공식-자료"
testingStatus: not_tested
correctionNote: "정정 사항이 없으면 이 줄을 생략합니다."
# 실제 검증한 합성 입력과 기대 결과를 공개할 때만 추가합니다.
# manifestPath의 해시와 sha256은 같은 실제 파일을 가리켜야 합니다.
# reproductionKit:
#   manifestPath: "/reproduction/<article-id>/<sha256>/manifest.json"
#   sha256: "<manifest SHA-256>"
#   toolPath: "/tools/<tool>/"
---
```

작성 순서:

1. 제목과 요약을 먼저 확정하고, 독자가 다시 확인할 수 있는 `https://` 또는 `http://` 출처를 최대 8개까지 적습니다.
2. AI가 조사나 초안 작성에 관여했다면 `aiAssisted: true`로 표시합니다. 기존 `author: "AI-Bot"` 글은 이 값이 자동으로 true로 추론됩니다.
3. 실제로 다시 실행하거나 확인한 날짜만 `lastReviewed`에 적습니다. 확인하지 않았다면 필드를 생략합니다.
4. `testingStatus`는 `not_tested`, `reproduced`, `official_source_only` 중 실제 상태를 선택합니다. 기본값은 `not_tested`입니다.
5. 수정 이력이 있을 때만 `correctionNote`를 적고, 게시 전 `draft: false`로 변경합니다.
6. `reproductionKit`은 합성 입력, 기대 결과와 manifest 해시를 실제로 대조한 글에만 추가합니다. 사용자 파일, 원본 업무 파일, 계정 정보와 로컬 경로는 키트에 포함하지 않습니다.

게시 후 글의 **작성·검증 정보** 패널은 비어 있는 항목을 `미제공` 또는 `미실시`로 표시합니다. 출처나 검토일을 추가했다고 해서 사이트가 독립적인 보증을 제공한다는 뜻은 아닙니다.

## 품질 게이트(`pnpm run check:posts`)

`pnpm run build`와 CI 테스트 단계가 먼저 `scripts/check-post-quality.mjs`를 실행합니다. 공개 글(`draft: false`)에 아래 규칙을 적용합니다.

| 규칙 | 내용 | 2026-10-24 이전 글 |
| --- | --- | --- |
| 출처 | 2개 이상, 그중 1개 이상은 learn.microsoft.com·support.microsoft.com·developers.google.com·support.google.com | 2개 미만은 경고 |
| 원본 자산 | `reproductionKit.manifestPath` 또는 `/tools/` 링크 | 경고 |
| 검증 상태 | `not_tested` 공개 불가, `reproduced`는 키트 필수, 도입 후 `official_source_only`는 신규 글의 25% 이하 | 동일 적용 |
| 분량·구조 | `lastReviewed` 필수, 본문 공백 포함 2,500자 이상, H2 3개 이상 | 동일 적용 |
| 금지 패턴 | 제목의 "완벽 가이드", "2026년 최신", "현명한 선택" 등, 태그의 trend·autopilot·외국어 트렌드 키워드 | 동일 적용 |
| 발행 속도 | 도입 후 7일 창마다 최대 3편 | 면제 |
| 사람 서명 | `humanReviewedBy`(사람 이름)와 `humanReviewedAt` 필수 | 경고 |

`draft: true` 글은 공개 대상이 아니므로 게이트에서 빠집니다.
