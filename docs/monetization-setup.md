# Advertising verification and optional Analytics

The default build activates neither ads nor Analytics. Environment variables are public build configuration, never a place for API keys. Real publisher/stream IDs, operator contact and an eligible production host must be established before activation. The current Vercel Hobby host and placeholder AdSense ID do not qualify.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://xici.vercel.app/` | Exact account-owned HTTPS origin with no path, query or fragment. Set this on the selected commercial host before verification. |
| `PUBLIC_ADSENSE_MODE` | `off` | `verify` emits verification meta and seller line only. `serve` deliberately fails the build until an account-supported certified CMP bootstrap and ads integration exist. |
| `PUBLIC_ADSENSE_PUBLISHER_ID` | empty | Real `pub-` or `ca-pub-` ID; example values are rejected. An ID alone never activates ads. |
| `PUBLIC_COMMERCIAL_HOSTING_CONFIRMED` | `false` | Explicit assertion after the actual host/plan is checked. Required for verification and Analytics. |
| `PUBLIC_ANALYTICS_ENABLED` | `false` | Independent opt-in to the consent-controlled GA4 integration. |
| `PUBLIC_GA4_MEASUREMENT_ID` | empty | Actual GA4 web stream ID. |
| `PUBLIC_GA4_AUTOMATIC_MEASUREMENT_DISABLED` | `false` | Assertion that automatic/Enhanced Measurement collection is disabled in the GA4 web stream. The site sends manual page views; this prevents duplicates and extra automatic events. |

Google documents a [non-ad-serving meta verification method](https://support.google.com/adsense/answer/7584263?hl=en), allowing a connection/review step before ads. Off mode serves only a comment in `/ads.txt`; verify mode emits the real seller identity and no AdSense script. Auto ads remains a separate, unperformed account action.

Optional Analytics uses [basic consent mode](https://developers.google.com/tag-platform/security/concepts/consent-mode): the Google loader is created only after an explicit saved/current grant on the canonical production origin. Preview origins do not initialize it. All advertising purposes default to denied. A site-owned Analytics choice is not a certified ad CMP and never enables ads.

The document has one controller and navigation listener. Manual views exclude admin/search, query strings, fragments and referrers. Repeated callbacks for the same path do not duplicate a view; returning after another route counts again. On withdrawal the integration disables measurement and replaces the document, with a URL override preserving refusal if storage fails. Other-tab withdrawals are observed. Existing sent data/cookies are not erased; the privacy page explains this. Choice storage expires after 180 days.

## Verification before real activation

- Run `node --experimental-strip-types --test tests/*.test.ts` and
  `corepack pnpm build`. The flag keeps the TypeScript test command compatible
  with the pinned Node 22.16.0 build version.
- Use the real account settings and canonical domain to inspect network traffic before grant, after grant, across repeated Astro navigation, after refusal and after withdrawal. Check preview and admin/search behavior. Confirm one Google loader and intended page views only in GA4 DebugView.
- Confirm the stream's automatic measurement is actually off and update the privacy page's real retention/host/contact details. Build-time flags are assertions, not proof of account configuration.
- Ad serving remains unavailable until the separate CMP/bootstrap/site-approval requirements in [Google integration requirements](w08-google-integration-requirements.md) are implemented and verified.

Current evidence: 24 automated tests pass, Astro check reports 84 files with zero diagnostics, the full static build reports 52 pages, and ESLint passes. Sol high independent review found three P2 issues (revocation order, GA placeholder IDs and missing bootstrap tests); all were corrected and rereview passed. Default build inspection of 53 HTML files found zero AdSense meta tags or external Google/AdSense script elements; `ads.txt` has no seller line. The origin integration tests prove that canonical, OG, robots and sitemap values move together and reject path-bearing, insecure, or explicitly empty origins. Local browser QA covered the main creator surfaces. No real Google account or ad network activation occurred. Actual activation remains off.
