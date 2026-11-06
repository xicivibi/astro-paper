/**
 * Build-time feature flags. Trend and marketplace surfaces stay off unless a
 * deployment opts in explicitly; the code paths remain for a later decision.
 */
export type FeatureFlags = Readonly<{ trendSurfaces: boolean }>;

export function resolveFeatureFlags(
  env: Record<string, string | boolean | undefined>
): FeatureFlags {
  const raw = env.PUBLIC_TREND_SURFACES;
  if (raw !== undefined && raw !== "" && raw !== "true" && raw !== "false") {
    throw new Error("PUBLIC_TREND_SURFACES must be true or false");
  }
  return Object.freeze({ trendSurfaces: raw === "true" });
}

type TrendMarkers = {
  tags?: readonly string[];
  trendBundle?: unknown;
  trendLifecycle?: unknown;
  marketplaceQuery?: string;
};

/** A post belongs to the frozen trend surface when it carries any trend marker. */
export function isTrendPost(data: TrendMarkers) {
  return Boolean(
    data.trendBundle ||
    data.trendLifecycle ||
    data.marketplaceQuery ||
    (data.tags ?? []).some(tag => tag.trim().toLowerCase() === "trend")
  );
}

export const featureFlags = resolveFeatureFlags(import.meta.env ?? {});
