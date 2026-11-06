/** Explicit build-time activation; identifiers alone never enable tracking. */
export type MonetizationConfig = Readonly<{
  adsenseMode: "off" | "verify" | "serve";
  publisherId: string;
  analyticsEnabled: boolean;
  measurementId: string;
  commercialHostingConfirmed: boolean;
  /** Serve mode only: the two manual ad unit IDs. */
  slots: Readonly<{ afterArticle: string; beforeNav: string }>;
  /** Where Consent Mode v2 starts as denied: everywhere (default) or EEA/UK/CH only. */
  consentScope: "everywhere" | "eea";
}>;

const PUBLISHER = /^(?:ca-)?pub-([0-9]{16})$/;
const SLOT = /^[0-9]{10}$/;
const SLOT_PLACEHOLDERS = new Set(["0000000000", "1111111111", "1234567890"]);
const PLACEHOLDERS = new Set([
  "0000000000000000",
  "1111111111111111",
  "1234567890123456",
]);

export function resolveMonetization(
  env: Record<string, string | boolean | undefined>
): MonetizationConfig {
  const adsenseMode = env.PUBLIC_ADSENSE_MODE || "off";
  if (!["off", "verify", "serve"].includes(String(adsenseMode))) {
    throw new Error("PUBLIC_ADSENSE_MODE must be off, verify, or serve");
  }
  // Serve needs the consent message published in AdSense Privacy & messaging
  // (Google-certified CMP). The owner confirms it with PUBLIC_ADSENSE_CMP=google.
  if (adsenseMode === "serve" && env.PUBLIC_ADSENSE_CMP !== "google") {
    throw new Error(
      "Ad serving requires the Google CMP bootstrap: publish the Privacy & messaging consent message, then set PUBLIC_ADSENSE_CMP=google"
    );
  }
  const commercialHostingConfirmed =
    env.PUBLIC_COMMERCIAL_HOSTING_CONFIRMED === "true";
  let publisherId = "";
  if (adsenseMode !== "off") {
    const match = PUBLISHER.exec(String(env.PUBLIC_ADSENSE_PUBLISHER_ID || ""));
    if (!match || PLACEHOLDERS.has(match[1])) {
      throw new Error("AdSense activation requires a real publisher ID");
    }
    if (!commercialHostingConfirmed) {
      throw new Error(
        "Confirm commercial hosting eligibility before AdSense setup"
      );
    }
    publisherId = `pub-${match[1]}`;
  }
  let slots = { afterArticle: "", beforeNav: "" };
  if (adsenseMode === "serve") {
    const afterArticle = String(env.PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE || "");
    const beforeNav = String(env.PUBLIC_ADSENSE_SLOT_BEFORE_NAV || "");
    for (const slot of [afterArticle, beforeNav]) {
      if (!SLOT.test(slot) || SLOT_PLACEHOLDERS.has(slot)) {
        throw new Error(
          "Ad serving requires two real 10-digit ad unit IDs (PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE, PUBLIC_ADSENSE_SLOT_BEFORE_NAV)"
        );
      }
    }
    if (afterArticle === beforeNav) {
      throw new Error("The two ad unit IDs must differ");
    }
    slots = { afterArticle, beforeNav };
  }
  const consentScope = String(env.PUBLIC_ADSENSE_CONSENT_SCOPE || "everywhere");
  if (consentScope !== "everywhere" && consentScope !== "eea") {
    throw new Error("PUBLIC_ADSENSE_CONSENT_SCOPE must be everywhere or eea");
  }
  const analyticsEnabled = env.PUBLIC_ANALYTICS_ENABLED === "true";
  const measurementId = analyticsEnabled
    ? String(env.PUBLIC_GA4_MEASUREMENT_ID || "")
    : "";
  if (
    analyticsEnabled &&
    (!/^G-[A-Z0-9]{6,20}$/.test(measurementId) ||
      /^G-(?:X+|0+|1+|TEST.*|EXAMPLE.*|ABCDEFG123)$/.test(measurementId))
  ) {
    throw new Error("Analytics activation requires a GA4 measurement ID");
  }
  if (
    analyticsEnabled &&
    (!commercialHostingConfirmed ||
      env.PUBLIC_GA4_AUTOMATIC_MEASUREMENT_DISABLED !== "true")
  ) {
    throw new Error(
      "Analytics requires confirmed hosting and disabled automatic measurement in the GA4 stream"
    );
  }
  return Object.freeze({
    adsenseMode: adsenseMode as MonetizationConfig["adsenseMode"],
    publisherId,
    analyticsEnabled,
    measurementId,
    commercialHostingConfirmed,
    slots: Object.freeze(slots),
    consentScope: consentScope as MonetizationConfig["consentScope"],
  });
}

export const monetization = resolveMonetization(import.meta.env || {});

export function adsTxt(config: MonetizationConfig): string {
  return config.adsenseMode === "off"
    ? "# Advertising is not enabled on this deployment.\n"
    : `google.com, ${config.publisherId}, DIRECT, f08c47fec0942fa0\n`;
}

/** Pages that never load the ad script: trust pages, tools, search and admin. */
export function isAdExcludedPath(pathname: string) {
  return /^\/(?:privacy|contact|about|admin|search|404|editorial-policy|tools)(?:\/|$)/.test(
    pathname
  );
}

const EEA_UK_CH = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "GB",
  "CH",
];

/**
 * Consent Mode v2 defaults, emitted before the AdSense loader. "everywhere"
 * denies ad storage for every visitor until the CMP updates it; "eea" denies
 * only for EEA/UK/CH visitors (an owner decision with revenue impact).
 */
export function consentDefaultScript(
  scope: MonetizationConfig["consentScope"]
) {
  const denied = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  };
  const calls =
    scope === "eea"
      ? [
          { ...denied, region: EEA_UK_CH },
          {
            ad_storage: "granted",
            ad_user_data: "granted",
            ad_personalization: "granted",
            analytics_storage: "denied",
          },
        ]
      : [denied];
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    ...calls.map(call => `gtag("consent","default",${JSON.stringify(call)});`),
  ].join("");
}

export function adsenseLoaderUrl(config: MonetizationConfig) {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${config.publisherId}`;
}

/** Footer/privacy button: reopen the Google consent message, loading it if needed. */
export function revocationScript(config: MonetizationConfig) {
  const loader = JSON.stringify(adsenseLoaderUrl(config));
  return `document.addEventListener("click",function(e){var t=e.target;if(!(t instanceof Element)||!t.closest("[data-ad-privacy-settings]"))return;if(!document.querySelector('script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')){var s=document.createElement("script");s.async=true;s.crossOrigin="anonymous";s.src=${loader};document.head.appendChild(s);}window.googlefc=window.googlefc||{};window.googlefc.callbackQueue=window.googlefc.callbackQueue||[];window.googlefc.callbackQueue.push(function(){window.googlefc.showRevocationMessage();});});`;
}
