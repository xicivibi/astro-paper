# W08 Google integration requirements

Checked 2026-09-13 (Asia/Seoul) against current Google documentation. Scope: this Astro static site with `ClientRouter`.

## Activation gates

All Google integrations remain off on the current site. The available AdSense value is a placeholder; the real publisher/Analytics IDs, approved consent setup, operator contact, and commercial-host eligibility are not verified. Format validity alone is insufficient.

| Mode | Required | Output allowed |
| --- | --- | --- |
| Default | none | No Google/AdSense scripts, events, meta tag, ad unit, or placeholder `ads.txt` |
| AdSense review | explicit review flag + real `ca-pub-...` ID | One verification meta tag **or** exact `ads.txt`; no ads or Analytics |
| Analytics | explicit Analytics flag + real tag ID + consent and host approval | One Google tag; consented GA4 events |
| Ads | explicit ads flag + real ID + approved site + certified CMP/consent + host approval | One AdSense loader and selected placements |

Use separate build-time flags for review, Analytics, and ads. Reject empty, malformed, example, repeated-zero/repeated-one, and known documentation sample IDs. IDs never activate a product by themselves. Host approval is a conservative project gate, not a Google rule.

## Policy and consent requirements

- **Google publisher policy:** AdSense publishers serving users in the EEA, UK, or Switzerland must use a Google-certified CMP integrated with the IAB Transparency and Consent Framework. Google lists enforcement dates of 2024-01-16 for EEA/UK and 2024-07-31 for Switzerland. The publisher must make the disclosures and obtain the consents required by Google's EU user consent policy. Certification does not establish compliance with every applicable law. [CMP requirement](https://support.google.com/adsense/answer/13554020?hl=en), [AdSense consent setup](https://support.google.com/adsense/answer/7670013?hl=en-GB)
- **Google technical requirement:** Consent mode v2 covers `ad_storage`, `ad_user_data`, `ad_personalization`, and `analytics_storage`. Defaults must precede every `config` or `event`; this project defaults all four to `denied`. Apply the CMP update on the page where the choice occurs, before a route transition. Persist the choice, restore it on later visits, and send a new denied update on revocation. Consent mode does not persist choices. [Consent mode setup](https://developers.google.com/tag-platform/security/guides/consent)
- **Project choice:** Use basic consent mode, which Google describes as sending no data before consent. Advanced mode sends consent-state/cookieless signals and needs a separate approval. [Consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- **Google CMP setup:** If using Google's AdSense CMP, enable advertising-purpose consent-mode mapping and Analytics mapping when GA4 is used. Google CMP updates only users shown its regional message; outside-region defaults still require an explicit decision. [CMP consent-mode settings](https://support.google.com/adsense/answer/16053245?hl=en-GB), [European messages](https://support.google.com/adsense/answer/10961068?hl=en)

Do not create TCF strings or infer consent. Provide a persistent privacy/cookie-settings entry point so users can reopen the CMP and revoke consent.

## Exact Google Privacy & Messaging bridge

Google supports asynchronous access only through `window.googlefc.callbackQueue`. For basic consent mode, initialize the namespace before the CMP runtime and enqueue the documented readiness key:

```js
window.googlefc = window.googlefc || {};
window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
window.googlefc.callbackQueue.push({
  CONSENT_MODE_DATA_READY: () => {
    const status = window.googlefc.getGoogleConsentModeValues();
    // Evaluate status, then load each independently enabled product once.
  },
});
```

After `CONSENT_MODE_DATA_READY`, `getGoogleConsentModeValues()` returns these fields:

- `adStoragePurposeConsentStatus`
- `adUserDataPurposeConsentStatus`
- `adPersonalizationPurposeConsentStatus`
- `analyticsStoragePurposeConsentStatus`

The documented enum meanings are `UNKNOWN` (0), `GRANTED` (1), `DENIED` (2), `NOT_APPLICABLE` (3), and `NOT_CONFIGURED` (4). Analytics may load only when its field is `GRANTED` or `NOT_APPLICABLE`. Ads may load only when all three ad fields are `GRANTED` or `NOT_APPLICABLE`. Block on `UNKNOWN`, `DENIED`, `NOT_CONFIGURED`, missing, or unfamiliar values. This is deliberately stricter than Google's sample because W08 requires explicit configuration.

Use one tested adapter around these documented numeric results. Google's current page uses short enum names in its definition but longer prefixed names in an example; do not guess a runtime enum property name. Verify it against the account-delivered runtime before activation. The return-object field names above are consistent. [Privacy & Messaging JavaScript API](https://developers.google.com/funding-choices/fc-api-docs)

Google's public documentation says Privacy & Messaging is normally deployed by an existing AdSense or Google Publisher Tag; it provides no standalone European-message bootstrap URL. Loading no AdSense tag while waiting for `googlefc` can therefore wait forever. Do not invent a Funding Choices URL. Ads remain disabled until an actual account verifies one of these paths:

1. an account-supported CMP bootstrap that runs before AdSense;
2. a reviewed AdSense-tag bootstrap with proof that consent controls ad requests; or
3. another Google-certified CMP with documented bootstrap and equivalent signals.

Review metadata and `ads.txt` do not depend on this bridge.

## Review and `ads.txt`

For review-only mode, prefer Google's non-ad-serving verification meta tag:

```html
<meta name="google-adsense-account" content="ca-pub-REAL_ID">
```

Google also accepts an `ads.txt` snippet as a connection method. Either can precede **Verify** and **Request review** without placing the AdSense script. Auto ads is a separate account action and stays off. Review-only mode must contain no `adsbygoogle.js`, `<ins class="adsbygoogle">`, or `adsbygoogle.push(...)`. [Connect a site](https://support.google.com/adsense/answer/7584263?hl=en), [Auto ads](https://support.google.com/adsense/answer/9261307?hl=en)

With a real ID and explicit review/ads activation, serve root `/ads.txt` as plain text using the account-provided line:

```text
google.com, pub-REAL_ID, DIRECT, f08c47fec0942fa0
```

Never publish a sample ID. Preserve other authorized sellers on separate lines. The root URL must return or correctly redirect to the file and `robots.txt` must allow crawling. [Ads.txt guide](https://support.google.com/adsense/answer/12171612?hl=en-GB), [crawler requirements](https://support.google.com/adsense/answer/7679060?hl=en)

## Singleton tags and GA4 SPA views

One shared-layout browser owner manages `dataLayer`, consent, scripts, events, and a document-lifetime sentinel. `ClientRouter` navigation must not recreate it.

- Load one `gtag.js` script and call `gtag('config', GA_ID, {send_page_view: false})` once. Google warns that duplicate tag configuration causes duplicate data or mixed settings. [Google tag installation](https://support.google.com/tagmanager/answer/15756615?hl=en), [gtag API](https://developers.google.com/tag-platform/gtagjs/reference)
- Load at most one `adsbygoogle.js?client=ca-pub-...` script, only after every ads gate passes. Review mode never loads it.
- In the GA4 web stream, disable Enhanced Measurement's **Page changes based on browser history events**; it can emit views despite `send_page_view: false`.
- Register one `astro:page-load` listener. After title/URL settle and Analytics consent is allowed, send one `page_view` with `page_title: document.title` and `page_location: location.href`.
- Deduplicate only the immediately current `origin + pathname + search` key, excluding the fragment. A later return after visiting another route is a new view.
- Send no views and place no ads on `/admin`, `/admin/...`, `/search`, or `/search/...`. This exclusion is a project choice.
- A first consent grant may emit one current eligible view. Repeated CMP callbacks, hydration, and transition scripts emit none.

Google requires disabling automatic measurement before manual SPA views to prevent duplicates. [GA4 pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views), [Enhanced Measurement](https://support.google.com/analytics/answer/9216061?hl=en)

## Acceptance checks

1. Default and placeholder builds contain no integration output or related network requests.
2. Review-only has exactly one real meta tag or exact root `ads.txt`, with no ad/Analytics traffic.
3. Before consent, there is no GA4/ad traffic; grant and revocation update state on the same document.
4. Initial load plus repeated ClientRouter navigation leaves one owner/listener, one Google loader, and at most one enabled AdSense loader.
5. Each eligible initial/navigation route emits one view; duplicate callbacks and admin/search routes emit zero. Confirm the GA4 property history-change option is off.
6. Ads activation fails unless the site, real ID, host, CMP bootstrap, consent mapping, and account approval are verified on the deployed domain.

Until every applicable gate passes, production stays off.
