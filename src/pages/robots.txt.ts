import type { APIRoute } from "astro";

// One group for every crawler (Googlebot, Yeti for Naver, Bingbot, ...):
// a crawler-specific group would replace these rules for that crawler.
const getRobotsTxt = (sitemapURL: URL) => `
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /search/

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  return new Response(getRobotsTxt(sitemapURL));
};
