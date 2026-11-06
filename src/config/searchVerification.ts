/**
 * Search engine ownership meta tags for Naver Search Advisor and Bing
 * Webmaster Tools. A tag is emitted only when its variable is set, and
 * malformed or sample values stop the build instead of shipping a fake tag.
 */
export type VerificationMeta = Readonly<{ name: string; content: string }>;

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const PLACEHOLDER =
  /^(?:x+|0+|1+|a+)$|example|sample|placeholder|your|change-?me|dummy|test/i;

const engines = [
  {
    variable: "PUBLIC_NAVER_SITE_VERIFICATION",
    name: "naver-site-verification",
  },
  { variable: "PUBLIC_BING_SITE_VERIFICATION", name: "msvalidate.01" },
] as const;

function isPlaceholder(value: string) {
  return PLACEHOLDER.test(value) || new Set(value.toLowerCase()).size <= 2;
}

export function resolveSearchVerification(
  env: Record<string, string | boolean | undefined>
): VerificationMeta[] {
  const metas: VerificationMeta[] = [];
  for (const engine of engines) {
    const raw = env[engine.variable];
    if (raw === undefined || raw === "") continue;
    const value = String(raw).trim();
    if (!TOKEN.test(value) || isPlaceholder(value)) {
      throw new Error(
        `${engine.variable} must be the real verification token from the search console`
      );
    }
    metas.push(Object.freeze({ name: engine.name, content: value }));
  }
  return metas;
}

export const searchVerification = resolveSearchVerification(
  import.meta.env ?? {}
);
