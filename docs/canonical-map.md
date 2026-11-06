# Xici 캐노니컬 지도

기준일: 2026-10-24. 이 문서는 "어느 저장소·브랜치가 기준인가"를 한곳에 고정합니다. 새 작업은 이 표에 맞춰 시작합니다.

## 프론트엔드(이 저장소)

| 항목 | 값 |
| --- | --- |
| 저장소 | `xicivibi/astro-paper` |
| 기준 브랜치 | `origin/main` |
| 기준 SHA | `550ce4232f2343bbb346717a733f506f6b7b422d` (PR #14, 로컬 마지막 fetch 2026-10-03) |
| 이번 작업 브랜치 | `feature/adsense-readiness` (위 SHA에서 분기) |
| 주 클론 | `oracle_macro/.worktrees/xici-frontend` (fetch만 하고 push는 소유자) |

- 로컬 `main`(de78276)은 `origin/main`보다 26커밋 뒤처져 있으므로 기준으로 쓰지 않습니다.
- `feature/manual-trend-lifecycle`(7cb0a87)도 main보다 뒤이며 기준이 아닙니다.
- 머지 전에 소유자가 `git fetch origin`으로 원격 main에 봇 커밋이 더 쌓였는지 확인합니다. 트렌드 cron은 이번 브랜치에서 `schedule`을 제거했지만, 머지 전까지는 원격에서 계속 돌 수 있습니다(GitHub Actions에서 수동 Disable 가능).

## 백엔드 두 계열

| 계열 | 위치 | 역할 |
| --- | --- | --- |
| develop | `oracle_macro` `claude/develop` d04f33ed, `01-프로젝트/제작·수익/ai_blog_server` | 초안 보조 도구(사람 검토 중심 초안 팩 CLI). 자동 발행 없음 |
| xici-draft-assist | `oracle_macro` `claude/xici-draft-assist` (d04f33ed에서 분기) | `draft-howto` 초안 팩 CLI와 백로그 확충 |
| commercial | `.worktrees/xici-commercial` 03aa818e | 트렌드 파이프라인. **동결, 읽기 참고만** |

## 미머지 로컬 브랜치 처분 제안(2026-10-24 기준)

삭제는 소유자가 결정합니다. 아래는 제안일 뿐이며 에이전트는 브랜치를 지우지 않습니다.

| 브랜치 | SHA | 내용 | 제안 |
| --- | --- | --- | --- |
| feature/google-trends-editorial | 451658e | 트렌드 편집 흐름 | 보관 후 삭제(트렌드 노선 종료) |
| feature/hamburger-trend-post | 1cc6f71 | 트렌드 글 | 삭제 |
| feature/hanjin-font | f211c3b | 폰트 교체 | **폐기 후보**: T9에서 Pretendard(OFL)로 확정(2026-10-25) |
| feature/host-independent-trend-rebuild | 377a658 | 트렌드 재빌드 | 삭제 |
| feature/manual-trend-lifecycle | 7cb0a87 | 트렌드 수명 관리 | 삭제(이미 main에 일부 반영) |
| feature/meat-delivery-trend | 2e99e4d | 트렌드 글 | 삭제 |
| feature/merchant-intent-gate | 1914ee7 | 쇼핑 의도 게이트 | 삭제 |
| feature/node24-lifecycle-ci | 55c3c8d | CI 러너 갱신 | 내용 확인 후 필요한 CI 변경만 별도 PR |
| feature/trend-first-home | 47b2be4 | 트렌드 우선 홈 | 삭제(이번 브랜치가 반대 방향) |
| feature/trend-fruit-20260927 | ef310e0 | 트렌드 글 | 삭제 |
| feature/trend-lifecycle-hook-gate | 034e090 | 트렌드 배포 훅 | 삭제 |
| feature/trend-marketplace-search | c50600f | 쇼핑 검색 링크 | 삭제 |
| feature/trend-offer-host-gate | 336db76 | 제휴 오퍼 게이트 | 삭제 |
| fix/cloudflare-main-release | 550ce42 | 이미 main에 머지됨 | 삭제 가능 |

## 재사용하지 않는 자산

- 2026년 5월 autopilot 산출물(`data/articles` 122개)은 어떤 형태로도 재사용하지 않습니다. 연예·로또·외국어 트렌드 키워드가 섞인 대량 생성 이력이라, 다시 쓰면 Google 스팸 정책의 "대규모 콘텐츠 악용" 판정 위험이 커집니다.
- 트렌드·쇼핑 렌더 경로(`marketplaceQuery`, `trendBundle`, `trendLifecycle`)는 코드로 남기되 `PUBLIC_TREND_SURFACES=true`일 때만 켜집니다. 기본값은 꺼짐입니다.
