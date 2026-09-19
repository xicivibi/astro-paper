/** Explicit build-time activation; identifiers alone never enable tracking. */
export type MonetizationConfig = Readonly<{
  adsenseMode: "off" | "verify" | "serve";
  publisherId: string;
  analyticsEnabled: boolean;
  measurementId: string;
  commercialHostingConfirmed: boolean;
}>;

const PUBLISHER = /^(?:ca-)?pub-([0-9]{16})$/;
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
  if (adsenseMode === "serve") {
    throw new Error(
      "Ad serving is unavailable until the account CMP bootstrap is implemented and verified"
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
  });
}

export const monetization = resolveMonetization(import.meta.env || {});

export function adsTxt(config: MonetizationConfig): string {
  return config.adsenseMode === "off"
    ? "# Advertising is not enabled on this deployment.\n"
    : `google.com, ${config.publisherId}, DIRECT, f08c47fec0942fa0\n`;
}
