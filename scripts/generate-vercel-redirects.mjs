/**
 * Builds path-preserving 301 redirects from the old Vercel host to the new
 * owned domain. Only URLs listed in the built sitemap (kept posts, static,
 * tool and hub pages) plus the feeds are mapped; deleted posts are not
 * redirected and keep returning 404.
 *
 * Usage:
 *   node scripts/generate-vercel-redirects.mjs --origin https://NEW-DOMAIN [--dist dist] [--write]
 * Without --write it prints the redirect list. With --write it updates the
 * "redirects" key of vercel.json and keeps the headers untouched.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTRA_PATHS = ["/rss.xml", "/sitemap-index.xml", "/sitemap-0.xml"];

/** @param {string} value */
function newOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("--origin must be the new HTTPS origin without a path");
  }
  return url.origin;
}

/**
 * @param {string} sitemapXml
 * @param {string} originValue
 */
export function buildRedirects(sitemapXml, originValue) {
  const origin = newOrigin(originValue);
  const paths = new Set();
  for (const match of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const pathname = new URL(match[1]).pathname;
    paths.add(pathname);
  }
  for (const path of EXTRA_PATHS) paths.add(path);
  /** @type {{ source: string, destination: string, statusCode: 301 }[]} */
  const redirects = [];
  for (const path of [...paths].sort()) {
    const destination = `${origin}${path}`;
    redirects.push({ source: path, destination, statusCode: 301 });
    // Also catch the same page requested without its trailing slash.
    if (path.length > 1 && path.endsWith("/")) {
      redirects.push({
        source: path.slice(0, -1),
        destination,
        statusCode: 301,
      });
    }
  }
  return redirects;
}

/**
 * @template {Record<string, unknown>} T
 * @param {T} vercelConfig
 * @param {ReturnType<typeof buildRedirects>} redirects
 * @returns {T & { redirects: ReturnType<typeof buildRedirects> }}
 */
export function withRedirects(vercelConfig, redirects) {
  return { ...vercelConfig, redirects };
}

function main() {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const args = process.argv.slice(2);
  /** @param {string} name */
  const option = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const origin = option("--origin");
  if (!origin) throw new Error("--origin is required");
  const dist = resolve(option("--dist") ?? join(root, "dist"));
  const sitemapPath = join(dist, "sitemap-0.xml");
  if (!existsSync(sitemapPath)) {
    throw new Error("build the site first: dist/sitemap-0.xml is missing");
  }
  const redirects = buildRedirects(readFileSync(sitemapPath, "utf8"), origin);
  if (args.includes("--write")) {
    const vercelPath = join(root, "vercel.json");
    const config = JSON.parse(readFileSync(vercelPath, "utf8"));
    writeFileSync(
      vercelPath,
      `${JSON.stringify(withRedirects(config, redirects), null, 2)}\n`
    );
    process.stdout.write(`vercel.json에 리다이렉트 ${redirects.length}개를 썼습니다.\n`);
  } else {
    process.stdout.write(`${JSON.stringify(redirects, null, 2)}\n`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
