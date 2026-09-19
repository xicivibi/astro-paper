export type HostingProvider = "vercel" | "cloudflare" | "other";

export type HostingConfig = Readonly<{
  provider: HostingProvider;
  name: string;
  privacyUrl: string;
}>;

const providers: Record<Exclude<HostingProvider, "other">, HostingConfig> = {
  vercel: {
    provider: "vercel",
    name: "Vercel",
    privacyUrl: "https://vercel.com/legal/privacy-policy",
  },
  cloudflare: {
    provider: "cloudflare",
    name: "Cloudflare",
    privacyUrl: "https://www.cloudflare.com/privacypolicy/",
  },
};

export function resolveHosting(
  siteUrl: string,
  env: Record<string, string | undefined>
): HostingConfig {
  const configured = env.PUBLIC_HOSTING_PROVIDER?.trim().toLowerCase();
  if (
    configured &&
    configured !== "vercel" &&
    configured !== "cloudflare" &&
    configured !== "other"
  ) {
    throw new Error(
      "PUBLIC_HOSTING_PROVIDER must be vercel, cloudflare, or other"
    );
  }

  const hostname = new URL(siteUrl).hostname.toLowerCase();
  let provider: HostingProvider;
  if (
    configured === "vercel" ||
    configured === "cloudflare" ||
    configured === "other"
  ) {
    provider = configured;
  } else if (hostname.endsWith(".vercel.app")) {
    provider = "vercel";
  } else if (hostname.endsWith(".pages.dev")) {
    provider = "cloudflare";
  } else {
    provider = "other";
  }

  return provider === "other"
    ? { provider, name: "현재 호스팅 제공자", privacyUrl: "" }
    : providers[provider];
}
