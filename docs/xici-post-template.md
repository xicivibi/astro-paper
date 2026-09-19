# Xici 게시글 작성 템플릿

이 템플릿은 `src/content/posts/`에 새 글을 추가할 때 사용합니다. 메타데이터는 독자가 작성 방식과 확인 범위를 이해하도록 돕지만, 값을 입력했다고 해서 자동으로 사실 검증이 완료되는 것은 아닙니다.

```yaml
---
author: "작성자 이름"
pubDatetime: 2026-09-19T09:00:00+09:00
title: "독자가 바로 이해할 수 있는 제목"
draft: true
editorialStatus: published
tags:
  - "주제"
description: "검색 결과와 공유 화면에 사용할 한두 문장 요약"
aiAssisted: true
lastReviewed: 2026-09-19T09:00:00+09:00
sources:
  - "https://example.com/공식-자료"
testingStatus: not_tested
correctionNote: "정정 사항이 없으면 이 줄을 생략합니다."
---
```

작성 순서:

1. 제목과 요약을 먼저 확정하고, 독자가 다시 확인할 수 있는 `https://` 또는 `http://` 출처를 최대 8개까지 적습니다.
2. AI가 조사나 초안 작성에 관여했다면 `aiAssisted: true`로 표시합니다. 기존 `author: "AI-Bot"` 글은 이 값이 자동으로 true로 추론됩니다.
3. 실제로 다시 실행하거나 확인한 날짜만 `lastReviewed`에 적습니다. 확인하지 않았다면 필드를 생략합니다.
4. `testingStatus`는 `not_tested`, `reproduced`, `official_source_only` 중 실제 상태를 선택합니다. 기본값은 `not_tested`입니다.
5. 수정 이력이 있을 때만 `correctionNote`를 적고, 게시 전 `draft: false`로 변경합니다.

게시 후 글의 **작성·검증 정보** 패널은 비어 있는 항목을 `미제공` 또는 `미실시`로 표시합니다. 출처나 검토일을 추가했다고 해서 사이트가 독립적인 보증을 제공한다는 뜻은 아닙니다.
