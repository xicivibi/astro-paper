# 소유 도메인 이전과 배포 방식 선택

기준일: 2026-10-24. 이 문서는 xici.vercel.app(Vercel Hobby, 비상업 전용)에서 소유 도메인과 상업용 호스트로 옮기는 절차입니다. 가입·결제·DNS·배포·콘솔 제출은 모두 **소유자**가 합니다. 저장소의 스크립트는 사전 점검과 파일 생성만 하고, 외부에는 아무것도 보내지 않습니다(`--deploy`를 소유자가 직접 붙일 때만 업로드).

## 1. 배포 방식 고르기(소유자 결정)

`deploy/deploy-method.json`의 `method`를 둘 중 하나로 바꿉니다. `undecided`이면 `release:cloudflare --deploy`가 거부됩니다.

| | A안: 스크립트 Direct Upload (권장) | B안: Cloudflare Git 연동 |
| --- | --- | --- |
| 값 | `"direct-upload"` | `"git-integration"` |
| 빌드 위치 | 소유자 PC | Cloudflare 빌드 서버 |
| 원격 main SHA 검증 | 유지(업로드 직전 `git ls-remote`로 확인) | Cloudflare가 main을 그대로 빌드. 같은 검사는 CI(`ci.yml`)에 의존 |
| verify 모드 준비도 점검 | 업로드 전에 `adsense-readiness`가 막음 | `pnpm build` 마지막 단계에서 막음(대시보드 환경변수로 verify를 켜면 빌드 실패) |
| 주의 | 소유자가 `wrangler login`을 한 번 해야 함 | Cloudflare 문서상 Git 연동 프로젝트는 나중에 Direct Upload로 바꿀 수 없음 |

A안을 권하는 이유: 이미 테스트된 커밋 고정·원격 검증 경로가 있고, 광고 모드 전환을 소유자가 명령 한 줄로 통제합니다.

### B안을 고를 때 Cloudflare 대시보드 환경변수

| 이름 | 첫 배포(off) | AdSense 신청(verify) |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://<도메인>` | 같음 |
| `PUBLIC_HOSTING_PROVIDER` | `cloudflare` | 같음 |
| `PUBLIC_ADSENSE_MODE` | `off` | `verify` |
| `PUBLIC_ADSENSE_PUBLISHER_ID` | 비움 | `pub-` + 16자리(소유자 계정 값) |
| `PUBLIC_COMMERCIAL_HOSTING_CONFIRMED` | `false` | `true`(소유자가 약관 확인 후) |
| `PUBLIC_OPERATOR_NAME` | 선택 | 공개 필명 |
| `PUBLIC_OPERATOR_EMAIL` | 선택 | 공개용 문의 이메일(필수) |
| `PUBLIC_NAVER_SITE_VERIFICATION` | 서치어드바이저 값 | 같음 |
| `PUBLIC_BING_SITE_VERIFICATION` | Bing 값 | 같음 |
| `NODE_VERSION` | `22.16.0`(.node-version과 동일) | 같음 |

빌드 명령은 `corepack pnpm build`, 출력 폴더는 `dist`입니다.

## 2. 첫 배포(광고 off)

A안 기준:

```powershell
# 사전 점검(업로드 없음)
npm run release:cloudflare -- --origin https://<도메인> --project <프로젝트명>
# 업로드(소유자가 직접, deploy-method.json이 direct-upload일 때만)
npm run release:cloudflare -- --origin https://<도메인> --project <프로젝트명> --deploy
```

- `*.pages.dev` origin은 경고를 냅니다. AdSense는 공유 서브도메인을 사이트로 추가할 수 없기 때문입니다. verify 모드에서는 거부합니다.
- 결과 JSON과 오류 메시지에는 게시자 ID를 쓰지 않습니다.

## 3. AdSense 신청(verify)

```powershell
$env:PUBLIC_ADSENSE_PUBLISHER_ID = "pub-<16자리>"
$env:PUBLIC_COMMERCIAL_HOSTING_CONFIRMED = "true"
$env:PUBLIC_OPERATOR_EMAIL = "<공개 문의 이메일>"
npm run release:cloudflare -- --origin https://<도메인> --project <프로젝트명> --adsense-mode verify
```

verify 모드는 다음이 모두 통과해야 빌드·업로드됩니다: 실제 게시자 ID 형식, 소유자의 상업 호스팅 확인, 운영자 이메일, `scripts/adsense-readiness.mjs`(공개 글 20편, 신뢰 페이지 4개, 운영자 경험 문단, 소유 도메인, 사이트맵·robots·ads.txt, 품질 게이트 경고 0건). 게시자 ID는 환경변수로만 넣고 저장소에 쓰지 않습니다.

## 4. 옛 주소에서 301 리다이렉트

새 도메인으로 배포한 뒤, 같은 커밋으로 빌드한 `dist`에서 리다이렉트 목록을 만듭니다.

```powershell
node scripts/generate-vercel-redirects.mjs --origin https://<도메인>          # 목록만 출력
node scripts/generate-vercel-redirects.mjs --origin https://<도메인> --write  # vercel.json에 기록
```

- 사이트맵에 있는 경로(유지 글 6편, 정적·도구·허브 페이지)와 RSS·사이트맵만 경로를 그대로 보존해 301로 보냅니다. 끝 슬래시 없는 요청도 함께 잡습니다.
- 삭제한 18개 글 주소는 리다이렉트하지 않습니다(404 유지).
- `--write` 결과를 PR로 올려 머지하면 Vercel이 리다이렉트를 적용합니다. xici.vercel.app에는 광고 코드를 넣지 않습니다(Hobby 약관).

## 5. 검색엔진 이전

1. **Google Search Console**: 새 도메인을 Domain 속성으로 추가하고 DNS TXT로 확인한 뒤 `https://<도메인>/sitemap-index.xml`을 제출합니다. 옛 xici.vercel.app URL-prefix 속성은 `public/googlecaeddca2a8b807d4.html`로 확인된 적이 있으므로, **주소 변경 도구 사용 가능 여부는 소유자 콘솔에서 확인**합니다. 쓸 수 없더라도 실측 트래픽이 거의 없어 301과 사이트맵 제출로 충분합니다.
2. **네이버 서치어드바이저**: 사이트 등록 → HTML 메타 태그 방식 선택 → 받은 값을 `PUBLIC_NAVER_SITE_VERIFICATION`에 넣고 재배포 → 소유 확인 → 사이트맵(`/sitemap-index.xml`)과 RSS(`/rss.xml`) 제출.
3. **Bing Webmaster Tools**: 사이트 추가 → 메타 태그 값을 `PUBLIC_BING_SITE_VERIFICATION`에 넣고 재배포 → 확인 → 사이트맵 제출(GSC에서 가져오기도 가능).

robots.txt는 모든 크롤러(Googlebot, Yeti, Bingbot)에 같은 규칙을 적용하고 `/admin/`, `/search/`만 막습니다.
