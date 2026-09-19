# Free static hosting migration preparation

Checked 2026-09-13. This is a reviewable migration procedure, not a deployed site or a new account.

Xici is currently on Vercel Hobby, verified through the connected project's team and domain records. [Hobby](https://vercel.com/docs/plans/hobby) limits use to non-commercial personal projects. Ads cannot launch under that plan. Additional spending remains zero.

Cloudflare Pages is the preferred free candidate for the existing static Astro output. The current build fits its [Free limits](https://developers.cloudflare.com/pages/platform/limits/): 500 builds/month, one concurrent build, 20-minute timeout, 20,000 files and 25 MiB per asset. Static requests are [free and unlimited](https://developers.cloudflare.com/pages/functions/pricing/). No server adapter, Functions, R2 or paid Worker is needed for this site.

The reviewed [Cloudflare terms](https://www.cloudflare.com/terms/) do not show a general ban on commercial or ad-supported sites; they do prohibit collecting credit-card information on a property receiving Free Services. The terms do not explicitly promise AdSense eligibility or perpetual free availability. The [pricing page](https://www.cloudflare.com/plans/) advertises starting free without a credit card. Record the actual selected plan and any product-specific terms during account setup; do not create a paid subscription or treat the existence of a Free tier as an ad approval.

The repository metadata currently points to `astro-paper.pages.dev`, but the
live page is the upstream AstroPaper demonstration and does not contain Xici's
title or content. It is not evidence of an account-owned Xici deployment and
must not be selected as the production origin.

## Prepared steps

1. Choose the actual account-owned Pages project hostname, initially its free `pages.dev` hostname if no owned custom domain exists. The name `xici.pages.dev` has not been reserved or checked for availability. Buying a domain is not a prerequisite for preparing the static deployment.
2. Decide Git integration before project creation: Cloudflare documents that a Git-integrated project cannot later switch to Direct Upload. The existing publication service writes to `xicivibi/astro-paper`, so Git integration is the proposed fit. The final merge/build would be a public deployment and has not occurred. [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/).
3. Set root to the frontend repository, production branch `main`, build
   `corepack pnpm build`, and output `dist`. The checked-in `.node-version`
   fixes Node `22.16.0`, satisfying the repository's `>=22.12.0` requirement
   and matching the documented Pages v3 default. Pages v3 does not detect
   Node from `package.json.engines`; keep `.node-version` or explicitly set
   the same `NODE_VERSION`. Preserve the pnpm lockfile and Pagefind copy step.
   [Astro guide](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/),
   [build image](https://developers.cloudflare.com/pages/configuration/build-image/).
4. Set `PUBLIC_SITE_URL` to the exact account-owned HTTPS origin, without a path,
   query or fragment. The build normalizes the trailing slash and applies the
   origin to `site.url` and `site.profile`; canonical, OG, robots and sitemap
   URLs therefore move together. An invalid or insecure origin fails the build.
   With the variable omitted, the current `https://xici.vercel.app/` origin
   remains the safe default until a real destination exists.
5. Update the privacy page's actual host and disclosure. Keep all advertising/Analytics flags off on the first preview. Verify assets, links, mobile layout, 404 and the local-only admin boundaries.
6. Prepare an old-to-new URL map and authorized redirects where technically and contractually available. Verify the new Search Console property and sitemap, and assess Change of Address eligibility. A provider-owned `vercel.app` hostname cannot be transferred as an owned DNS domain; continuity redirects remain unresolved. [Google site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).
7. Update the backend's canonical publication policy and issue new, explicitly scoped authority for the final hostname. Never silently reuse an approval bound to `xici.vercel.app`.
8. Connect the real AdSense account to the new site and perform its own review, consent and crawler checks. Hosting migration alone does not authorize ads. [AdSense sites](https://support.google.com/adsense/answer/9131547?hl=en).

Completion evidence must include the real hostname, selected free plan, exact deployed commit, build/link checks, Search Console access outcome and actual AdSense status. These are still pending. The static build and this procedure are available now.

Local origin preflight:

```powershell
$env:PUBLIC_SITE_URL = "https://ACTUAL_PROJECT.pages.dev"
corepack pnpm build
```

Cloudflare Pages build settings:

- Production branch: `main`
- Build command: `corepack pnpm build`
- Output directory: `dist`
- Build variable: `PUBLIC_SITE_URL=https://ACTUAL_PROJECT.pages.dev`
- Node.js: `22.16.0` via the checked-in `.node-version`
- Optional explicit mirror: `NODE_VERSION=22.16.0`
