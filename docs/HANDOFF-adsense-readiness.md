# 인수인계: Xici AdSense 준비(xici-adsense 트랙)

작성일: 2026-10-25. 에이전트는 로컬 커밋까지만 했습니다. push, PR, 배포, 가입, 결제, 콘솔 제출은 하지 않았습니다.

## 1. 위치

| 구분 | 경로 | 브랜치 | 기준 |
| --- | --- | --- | --- |
| 프론트엔드(xicivibi/astro-paper) | `oracle_macro/.worktrees/xici-adsense` | `feature/adsense-readiness` | 550ce42(origin/main, 2026-10-03 fetch) |
| 백엔드 초안 도구(oracle_macro) | `oracle_macro/.claude/worktrees/xici-draft` | `claude/xici-draft-assist` | d04f33ed(claude/develop) |

계획은 작업마다 브랜치를 나누라고 했지만, 지정된 워크트리 하나에서 작업 단위별 작은 커밋으로 나눴습니다. PR을 나누고 싶으면 아래 커밋을 cherry-pick 하면 됩니다.

## 2. 만든 것

### 프론트엔드 커밋(오래된 순)

| 커밋 | 작업 | 내용 |
| --- | --- | --- |
| f1fe3e6 | T1 | 트렌드 cron의 `schedule` 제거(수동 실행만 남김), CI에 테스트 단계 추가(타임아웃 8분), 트렌드·쇼핑 화면을 `PUBLIC_TREND_SURFACES`(기본 꺼짐) 뒤로 숨김, `docs/canonical-map.md` |
| 395c4d6 | T3 | legacy_hold 15편과 만료 트렌드 3편 삭제(이력은 git에 남음). 보류 장치는 빈 목록으로 유지하고 픽스처로 테스트 |
| 69e90d1 | T2 | 글마다 `topic` 허브 필수(초안 제외), 사이트 설명을 업무 데이터 방향으로 변경, 홈을 허브·먼저 읽을 글·무료 도구 4개 중심으로 교체 |
| cc119b7 | T4 | `scripts/check-post-quality.mjs` 품질 게이트를 빌드 앞과 CI에서 강제. 6편에 빈 `humanReviewedBy`/`humanReviewedAt` 자리 추가 |
| 3b6f2a5 | T8, T11 | 개인정보처리방침(광고 쿠키, partner-sites, 처리 항목·보관·문의), 소개(범위, AI 공개, 재현 표기 원칙, 바이라인), 운영자 경험 자리(소유자 작성 전 숨김), 글 바이라인·사람 검토 표시, verify/serve에서 운영자 이메일 없으면 빌드 실패, 네이버·Bing 인증 메타(값 검증) |
| 4672f16 | T6 | `scripts/adsense-readiness.mjs` 준비도 점검. `pnpm build` 끝에서 실행하며 off 모드는 막지 않음 |
| 14c1678 | T10 | `release:cloudflare --adsense-mode off|verify`, pages.dev 경고·verify 거부, 게시자 ID 출력 금지, 배포 방식 선택 파일, 옛 주소 301 생성기, `docs/domain-migration.md` |
| 56078e5 | T5 연계 | 백엔드가 만든 초안 샘플을 품질 게이트로 검사하는 테스트 |
| 69a70fd | T7 | serve 모드(조건 4개, Consent Mode 기본 거부, 글 페이지 로더 1회, 수동 슬롯 2개, 제외 페이지, 중복 push 방지, 동의 다시 열기, 인라인 해시 CSP), 운영 CSP에서 localhost 제거 |
| e6b13ab | 정리 | 날짜 로캘 글 표 정렬(공백만). 중복 제거 글은 공백이 내용이라 `.prettierignore`에 등록 |

주의: 14c1678 시점에는 테스트 파일 타입 오류로 `astro check`가 실패합니다. 69a70fd에서 고쳤으니 이 커밋들은 함께 머지하세요.

### 백엔드 커밋

| 커밋 | 작업 | 내용 |
| --- | --- | --- |
| 864d147d | T5, T6 | `python -m app.cli draft-howto --backlog-row N --frontend <워크트리>`: 한 번에 1편, 글 초안(draft, not_tested, 서명 필드 없음)과 대기 재현 키트(결정적 생성, `result: pending`), 소유자 체크리스트를 프론트 워크트리에 씀. Claude는 `claude_runtime`만 사용(초안 sonnet, 체크리스트 haiku), 모델·비용은 `data/draft_runs.jsonl`. 백로그는 32행(허브별 13/11/8), 공개 글과 겹치던 5행 제거 |
| 5f0a9a3a | 리뷰 수정 | 소유자가 Excel로 `status`를 고친 백로그를 읽도록 수정. "CSV UTF-8" 저장의 BOM 때문에 `KeyError: priority`로 죽던 문제를 `utf-8-sig`로 해결하고, 앞뒤 공백 열 이름·끝의 빈 행은 무시합니다. ANSI(cp949) 저장, 열 이름 변경, 숫자가 아닌 priority는 한국어 오류(종료 코드 2)로 알립니다. CLI가 `BACKLOG`/`RUN_LOG`를 호출 시점에 넘겨, 테스트가 실제 `data/draft_runs.jsonl`에 쓰지 않습니다. 회귀 테스트 6개 |

### 하지 않은 것

- **T9(폰트)**: 2026-10-25 소유자 결정(공개 광고 사이트는 OFL 예외)에 따라 완료. 사이트 글꼴을 자체 호스팅 Pretendard 1.3.9(OFL 1.1)로 바꿨습니다. 브라우저에는 원본 TTF를 글리프 손실 없이 변환한 `public/fonts/Pretendard-Regular.woff2`(765KB, 기존 Hanjin TTF 5.7MB)와 `OFL.txt`를 내보내고, OG 이미지는 빌드 때만 `src/assets/fonts/Pretendard-Regular.ttf`를 씁니다(satori는 WOFF2를 읽지 못함). `public/fonts/HanjinGroupSans-Regular.ttf`는 삭제했고, dist에 Hanjin이 남지 않는지 `tests/dist-contract.test.ts`가 확인합니다.
- **T12(주간 측정)**: 노출 데이터가 생긴 뒤 착수.
- 실제 브라우저 광고 검사(Playwright 네트워크 스텁, CLS, Lighthouse): Playwright가 저장소 의존성에 없어 설치(네트워크) 없이는 못 돌립니다. 슬롯 push 중복 방지는 단위 테스트로, 슬롯 높이 예약(280px)은 빌드 결과 검사로 대신했습니다.
- 대기 키트를 `public/reproduction/<slug>/<sha256>/`로 확정하는 스크립트.

## 3. 실행 방법

프론트엔드(`.worktrees/xici-adsense`):

```powershell
corepack pnpm@10.11.1 install --frozen-lockfile
corepack pnpm@10.11.1 test          # 테스트(off·verify·serve 모드 빌드 포함, 약 2~3분)
corepack pnpm@10.11.1 lint
corepack pnpm@10.11.1 build         # 품질 게이트 → astro check → 빌드 → 준비도 점검
node scripts/check-post-quality.mjs # 게이트만
node scripts/adsense-readiness.mjs --mode verify   # 준비도(빌드 후)
npm run release:cloudflare -- --origin https://<도메인> --project <이름>   # 업로드 없는 사전 점검
node scripts/generate-vercel-redirects.mjs --origin https://<도메인>        # 301 목록
```

백엔드(`.claude/worktrees/xici-draft/01-프로젝트/제작·수익/ai_blog_server`):

```powershell
# 아래 자리표시자를 원본 백엔드 폴더의 실제 경로로 바꿉니다.
$backendPython = Join-Path '<원본 백엔드 폴더>' '.venv/Scripts/python.exe'
& $backendPython -m pytest -q   # 원본 저장소의 venv(워크트리에는 venv 없음)
$env:XICI_FRONTEND_DIR = "<프론트 워크트리>"
& $backendPython -m pytest -q   # 같은 인터프리터로 프론트 게이트 연동 테스트까지
python -m app.cli draft-howto --backlog-row 3 --frontend <프론트 워크트리>  # 실제 Claude 구독 호출 2회
```

## 4. 검증 결과(2026-10-25 실행)

- 프론트 `pnpm test`: **124개 통과, 실패 0**(기준선 63개). 빌드 기반 테스트는 임시 폴더에 off·verify·serve 모드를 각각 빌드합니다. 테스트 파일은 순서대로 실행(`--test-concurrency=1`)해 빌드끼리 겹치지 않게 했습니다.
- 프론트 `pnpm lint`: 오류 0. `pnpm build`: astro check 오류·경고·힌트 0, 게이트 오류 0·경고 8, 준비도는 off 모드라 통과 처리.
- 백엔드 pytest: **268개 통과, 3개 건너뜀**(기준선 249개 통과, 2개 건너뜀; 리뷰 수정 전 262개). 리뷰 수정의 회귀 테스트 6개는 수정 전 코드에서 모두 실패하는 것을 확인했습니다. `XICI_FRONTEND_DIR`을 주면 게이트 연동 테스트 1개가 추가로 실행됩니다.
- 백엔드 테스트는 `01-프로젝트/제작·수익/ai_blog_server/.venv`의 Python으로 실행했습니다(루트 `.venv`에는 pytest가 없습니다).
- 테스트 중 실제 네트워크, wrangler, Claude CLI 호출은 0회입니다(가짜 CLI·모킹).
- 모델 사용: 이 작업의 도구들은 실제 Claude 호출을 하지 않았습니다. 이 세션 본체 모델(Opus 5.5)은 바뀌지 않았습니다.

품질 게이트 경고 8건의 내역: 6편 모두 사람 서명 없음, 폴더 결합 글 출처 1개, 날짜 로캘 글 원본 자산(키트·도구 링크) 없음. 계획은 "서명 경고 6건만"을 기대했지만, 실제 글 상태를 확인해 보니 뒤의 두 건이 있어 2026-10-24 이전 글에는 경고로만 처리했습니다. 준비도 점검은 경고 0건을 요구하므로 신청 전에 해결해야 합니다(아래 5번).

## 5. 소유자 할 일(순서대로)

0. **(선택, 즉시)** GitHub xicivibi/astro-paper → Actions → "Trend lifecycle rebuild"를 Disable합니다. 이번 브랜치를 머지하기 전까지 봇이 main에 push할 수 있습니다.
1. ~~폰트 결정(T9)~~: 완료(2026-10-25, Pretendard OFL). 이 브랜치를 머지·배포하기 전까지는 xici.vercel.app에 Hanjin TTF가 계속 공개돼 있으므로 머지를 미루지 않는 것이 좋습니다.
2. **브랜치 검토와 머지**: `git fetch origin`으로 원격 main에 봇 커밋이 더 쌓였는지 확인한 뒤 push·PR·머지합니다. 특히 확인할 것:
   - T3은 글 18편 삭제입니다(콘텐츠 삭제 명시 승인 필요).
   - 운영 CSP에서 `http://127.0.0.1:8081`을 뺐습니다. 배포된 사이트의 `/admin/`에서 이 PC의 API에 붙던 방식은 더 이상 동작하지 않으므로 `pnpm dev`(localhost)에서 관리 화면을 씁니다.
3. **호스팅·도메인**: Cloudflare 가입, 도메인 1개 구매(.com 약 US$10~11/년 또는 .kr 약 ₩1.5만~2.5만/년). `deploy/deploy-method.json`의 `method`를 `direct-upload`(권장) 또는 `git-integration`으로 바꿉니다. 근거는 `docs/domain-migration.md`.
4. **운영자 공개 정보**: 필명과 공개용 문의 이메일(개인 메일과 분리)을 정해 빌드 환경변수 `PUBLIC_OPERATOR_NAME`, `PUBLIC_OPERATOR_EMAIL`에만 넣습니다. `src/content/pages/operator-experience.md`에 실제 업무 경험을 직접 쓰고 `ownerStatus: "written"`으로 바꿉니다(`docs/operator-experience-guide.md`). 개인정보처리방침의 "처리가 끝나면 지체 없이 삭제" 문구가 실제 운영과 맞는지 확인합니다.
5. **기존 6편 서명과 두 가지 공백 해결**: 각 글을 다시 읽고 `humanReviewedBy`(사람 이름)와 `humanReviewedAt`을 직접 채웁니다. 폴더 결합 글은 직접 확인한 공식 문서를 두 번째 출처로 추가합니다. 날짜 로캘 글은 Excel에서 재현해 키트를 만들거나, 관련 도구 링크를 붙일지 결정합니다(둘 다 안 하면 준비도 점검이 통과하지 않습니다).
6. **첫 배포(광고 off)**: `npm run release:cloudflare -- --origin https://<도메인> --project <이름> --deploy`(A안). 그다음 `node scripts/generate-vercel-redirects.mjs --origin https://<도메인> --write`로 vercel.json에 301을 쓰고 PR로 머지합니다. xici.vercel.app에는 광고 코드를 넣지 않습니다.
7. **검색엔진 등록**: Google Search Console Domain 속성(DNS TXT) 확인과 `sitemap-index.xml` 제출, 옛 속성의 주소 변경 도구 사용 가능 여부 확인. 네이버 서치어드바이저와 Bing은 받은 값을 `PUBLIC_NAVER_SITE_VERIFICATION`, `PUBLIC_BING_SITE_VERIFICATION`에 넣고 재배포한 뒤 확인·사이트맵·RSS 제출.
8. **매주 2편 재현**: 백로그 수요를 자동완성·네이버 연관검색어로 확인해 `status`를 갱신합니다. Excel로 고칠 때는 "CSV UTF-8(쉼표로 분리)"로 저장하고 열 이름은 바꾸지 않습니다(일반 "CSV"로 저장하면 `draft-howto`가 UTF-8로 다시 저장하라고 알리고 멈춥니다). `draft-howto`로 초안을 2~4개씩만 만들고, 체크리스트대로 실제 Excel·Sheets에서 따라 한 뒤 경험 문단·화면·`testingStatus`·서명을 채웁니다(편당 60~90분). 대기 키트(`public/reproduction/<slug>/pending/`)는 재현 전에는 커밋하지 않는 것을 권합니다(커밋하면 정적 파일로 공개됩니다).

   **8번의 기계 실행 증거가 있는 글: 편당 약 15분 검토·서명 루틴**

   글을 읽고(약 5분), `docs/drafts/<slug>-checklist.md`대로 다시 실행하거나 `lab/excel/cases/<slug>/result.json`의 관측 수치와 본문을 비교합니다(약 7분). 미확인 항목(`not_verified`)과 재현 범위를 확인한 뒤, 본인의 이름·필명으로 먼저 미리보기하고 서명합니다(약 3분).

   ```powershell
   node scripts/sign-post.mjs --status
   node scripts/sign-post.mjs <slug> --name "본인 필명" --dry-run
   node scripts/sign-post.mjs <slug> --name "본인 필명"
   # 선택: --note "직접 경험한 한 문장" / --date YYYY-MM-DD
   # 같은 명령의 npm 진입점: npm run sign:post -- <slug> --name "본인 필명"
   # 이미 공개된 글의 키트만 보충(서명·본문·발행일 유지):
   node scripts/sign-post.mjs power-query-csv-date-using-locale --kit-only --dry-run
   node scripts/sign-post.mjs power-query-csv-date-using-locale --kit-only
   ```

   이 명령은 사람이 내린 결정을 기록할 뿐 Excel 실행이나 검토를 대신하지 않으며 자동 실행에 연결하지 않습니다. 이름 없는 서명·AI 이름·미완성 문구·경로 노출·실패/오래된 입력 증거·품질 게이트 오류는 쓰기 전에 거부합니다. 서명 성공 시에만 합성 입력·M·로컬 실행 메타데이터를 뺀 관측 JSON을 SHA-256 키트로 확정하고 해당 글의 `pending/`을 정리합니다. 다른 필드와 본문 바이트는 유지하며 `--note`만 첫 본문 문단 뒤에 넣습니다. 검증 후 임시 폴더에 준비하고 이동하며, 이동 실패 시 원복합니다. 강제 종료나 원복 자체의 파일 접근 실패 시에는 남은 `.sign-post-*`의 원본/대기 키트를 보존하고 오류 안내에 따라 복구합니다.

   날짜 생략 시 현재 시각과 KST 오늘 09:00 중 늦은 시각부터 가장 빠른 날을 고릅니다. 게이트와 같은 7일 구간 `[시작, 시작+7일)`에서 최대 3편이며 정확히 7일 뒤는 이전 구간에 포함하지 않습니다. 이미 잡힌 미래 발행일도 함께 검사합니다. 운영 빌드는 예약 시각 **15분 전**까지 글 경로를 만들지 않습니다(`postFilter.ts`, `getStaticPaths`). 이후 **다시 빌드·배포해야** 글이 공개되며 이 명령은 배포나 자동 재빌드를 하지 않습니다. 본문에서 참조하는 before/after PNG는 lab의 검증된 이미지가 둘 다 있어야 하며, 서명 또는 --kit-only 성공 시 키트·글과 함께 public/images/excel-lab/<slug>/로 확정합니다. --dry-run은 두 복사 대상을 출력하고 아무 파일도 쓰지 않습니다. 쓰기 실패 시 새 이미지·키트를 원복하고, 기존 공개 이미지가 다르면 덮어쓰기를 거부합니다. 초안 이미지 26장은 public에서 제거했습니다. 키트와 서명 후 복사된 이미지는 정적 공개 자산이므로 예약 글 공개 시각과 별도로 다음 배포 묶음에 들어갑니다. `--status`의 20편 기준은 준비도 상수를 재사용하며 실제 신청 자격은 빌드된 사이트맵과 나머지 준비도 항목으로 판단합니다.

   도구 선정: 기존 Node `fs`/`crypto`/`zlib`, 게시물 파서, 품질 게이트·준비도 상수와 키트 로더를 재사용했습니다(로컬 호출·fixture 검증). 추가 후보인 YAML/ZIP 패키지는 기존 파서·표적 필드 수정·기본 압축 해제로 충분해 제외했고, Excel/Drive 커넥터와 외부 API는 저장된 증거 확정에 불필요해 연결하지 않았습니다. 이번 검증은 설치된 기존 `node:test` 진입점을 사용했습니다. 추가 후보인 Vitest는 별도 설치·캐시 호출 없이 기존 테스트로 충분해 제외했습니다. 유료 호출·계정 변경·배포는 없습니다.

   2026-11-07 검증: `npm.cmd test`는 **156개 통과·실패 0**, `npm.cmd run lint`는 통과했습니다. `node scripts/check-post-quality.mjs`는 공개 **6편·오류 0·경고 7**입니다(사람 서명 6건, 기존 날짜 로캘 글의 원본 자산 1건). Excel `run-all`을 수정 후 두 번 실행해 각각 **15/15 통과**, `python lab/excel/verify_runs.py first second`는 **15/15 관측·PNG 메타데이터 동일**입니다. 수정 전 기준선과도 15개 사례의 수식/M·관측값·합계·검증 결과가 같았습니다(변경한 캡처 메타데이터 제외). Python 증거 회귀 테스트 **8개 통과**, 남은 자체 Excel 프로세스 **0개**입니다. 실험자료가 있는 초안 **14편**의 `--name "테스트필명" --dry-run`과 공개 날짜 로캘 글의 `--kit-only --dry-run`이 **15/15 통과**했고 검사 대상 파일 해시가 유지됐습니다. 이미지 직접 검토 대상은 두 제외 사례를 뺀 **13편·26장**이며, 그 13편의 이미지 섹션만 구체적인 대체 텍스트·캡션으로 고쳤습니다. 범위 설명의 오타는 14편을 검색해 4편에서 최소 수정했습니다. `sanitize_public.py`는 on-disk 결과의 printer·cleanup·retired_instances를 제거하고 cleanup_verified만 보존합니다. 개인정보 스캔 결과와 사례별 이미지 범위는 [이번 검토 기록](REVIEW-sign-tool-lab-2026-11-07.md)에 있습니다. 공개 상태는 **6/20편, 추가 14편**이며 실제 사람 서명·커밋·push·배포·다른 에이전트 호출은 하지 않았습니다.

9. **AdSense 신청**: 공개 글 20편 이상, 준비도 점검 전 항목 통과, 색인 시작을 확인한 뒤 기존 AdSense 계정(1인 1계정)에 사이트를 추가합니다. `PUBLIC_ADSENSE_PUBLISHER_ID`, `PUBLIC_COMMERCIAL_HOSTING_CONFIRMED=true`, 운영자 이메일을 환경변수로 넣고 `--adsense-mode verify`로 배포한 뒤 검토를 요청합니다. 자동 광고는 끕니다.
10. **승인 후 serve**: Privacy & messaging에서 EEA/UK/CH 동의 메시지를 게시하고, 광고 단위 2개를 만들어 `PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE`, `PUBLIC_ADSENSE_SLOT_BEFORE_NAV`에 넣습니다. `PUBLIC_ADSENSE_CMP=google`을 설정하고, Consent Mode 기본값 범위(`PUBLIC_ADSENSE_CONSENT_SCOPE`: `everywhere` 기본, 또는 `eea`)를 정합니다. `--adsense-mode serve`로 재배포한 뒤 실제 브라우저에서 로더 1회·슬롯 2개·레이아웃 이동을 확인합니다. 결제·세금 정보와 PIN 우편 인증을 진행하고, 본인 광고 클릭은 하지 않습니다.
11. **데이터가 생기면**: 매주 GSC·네이버 CSV를 받아 T12 스크립트(추후 작업)로 갱신할 글과 새 글 2편을 고릅니다.

## 6. 소유자 결정이 필요한 항목(플래그로 분리해 둠)

| 결정 | 현재 기본값 | 위치 |
| --- | --- | --- |
| 폰트 유지/예외(T9) | Pretendard(OFL)로 확정·적용 | `src/styles/global.css`, `public/fonts/` |
| 배포 방식 A/B | `undecided`(`--deploy` 거부) | `deploy/deploy-method.json` |
| 트렌드·쇼핑 화면 재개 | 꺼짐 | `PUBLIC_TREND_SURFACES` |
| 동의 기본값 범위 | 모든 지역 거부 | `PUBLIC_ADSENSE_CONSENT_SCOPE` |
| 운영자 경험 문단 공개 | 숨김(`placeholder`) | `src/content/pages/operator-experience.md` |

## 7. 남은 위험

- 신규 도메인이라 색인·신뢰가 쌓이는 데 수개월이 걸리고, 공개 글 6편으로는 승인 가능성이 낮습니다. 임계 경로는 소유자 재현 처리량(주 2편)입니다.
- serve CSP는 `'strict-dynamic'` 대신 인라인 스크립트 해시와 `'self' https:`를 씁니다. Astro 모듈 스크립트에 nonce·무결성 해시가 없어서입니다. 인라인 주입은 막지만 임의의 HTTPS 외부 스크립트는 허용합니다.
- 기존 GA4 연동(`PUBLIC_ANALYTICS_ENABLED`)은 운영 CSP(`script-src 'self' 'unsafe-inline'`)와 맞지 않을 수 있습니다. 이번 범위 밖이라 그대로 두었습니다.
- 법·세무: 개인정보 보호법 처리방침 고지, 회사 겸업 규정, AdSense 해외 수입의 종합소득세 신고를 정리해야 합니다.
