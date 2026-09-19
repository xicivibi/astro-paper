import { defineAstroPaperConfig } from "./src/types/config";

const configuredSiteValue = process.env.PUBLIC_SITE_URL;
if (configuredSiteValue !== undefined && !configuredSiteValue.trim()) {
  throw new Error("PUBLIC_SITE_URL must not be empty when configured");
}
const configuredSiteUrl = new URL(
  configuredSiteValue?.trim() ?? "https://xici.vercel.app/"
);
if (configuredSiteUrl.protocol !== "https:") {
  throw new Error("PUBLIC_SITE_URL must be an HTTPS origin");
}
if (
  configuredSiteUrl.pathname !== "/" ||
  configuredSiteUrl.search ||
  configuredSiteUrl.hash
) {
  throw new Error("PUBLIC_SITE_URL must be an origin without a path");
}
const siteUrl = configuredSiteUrl.origin.concat("/");

export default defineAstroPaperConfig({
  site: {
    url: siteUrl,
    title: "직장인 자동화 실험실",
    description:
      "Excel·CSV와 업무 자동화 문제를 재현 가능한 예제와 공식 근거로 해결하는 한국어 실무 가이드.",
    author: "직장인 자동화 실험실",
    profile: siteUrl,
    ogImage: "default-og.jpg",
    lang: "ko",
    timezone: "Asia/Seoul",
    dir: "ltr",
  },
  posts: {
    perPage: 30,
    perIndex: 30,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [],
  shareLinks: [
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
