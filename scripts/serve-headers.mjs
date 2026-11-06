/**
 * Serve-mode security headers, generated from the built HTML.
 *
 * Every executable inline script in dist is allowed by its exact SHA-256
 * hash, so 'unsafe-inline' is not needed for scripts. External scripts are
 * allowed from this origin and from any HTTPS host: AdSense and the Google
 * consent message load from Google hosts that change over time, and an
 * allowlist would break them silently. 'strict-dynamic' is not used because
 * Astro's own module scripts carry neither a nonce nor an integrity hash.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const EXECUTABLE_TYPES = new Set(["", "module", "text/javascript", "application/javascript"]);

/** @param {string} html */
export function inlineScripts(html) {
  /** @type {string[]} */
  const bodies = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1];
    if (/\ssrc\s*=/i.test(attributes)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1] ?? "";
    if (!EXECUTABLE_TYPES.has(type.toLowerCase())) continue;
    bodies.push(match[2]);
  }
  return bodies;
}

/** @param {string} body */
export function scriptHash(body) {
  return `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
}

/** @param {string} directory */
function htmlFiles(directory) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...htmlFiles(path));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

/** @param {string} distDirectory */
export function collectInlineHashes(distDirectory) {
  const hashes = new Set();
  for (const file of htmlFiles(distDirectory)) {
    for (const body of inlineScripts(readFileSync(file, "utf8"))) {
      hashes.add(scriptHash(body));
    }
  }
  return [...hashes].sort();
}

/** @param {string} distDirectory */
export function servesAds(distDirectory) {
  return htmlFiles(distDirectory).some(file =>
    readFileSync(file, "utf8").includes(
      "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
    )
  );
}

/** @param {string[]} hashes */
export function serveContentSecurityPolicy(hashes) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' ${hashes.join(" ")} https:`.replace(/\s+/g, " "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src https:",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Rewrites the Content-Security-Policy line of the static `_headers` text.
 * @param {string} baseHeaders
 * @param {string[]} hashes
 */
export function serveHeaders(baseHeaders, hashes) {
  const policy = serveContentSecurityPolicy(hashes);
  if (!/^\s*Content-Security-Policy:/m.test(baseHeaders)) {
    throw new Error("base headers have no Content-Security-Policy line");
  }
  return baseHeaders.replace(
    /^(\s*)Content-Security-Policy:.*$/m,
    `$1Content-Security-Policy: ${policy}`
  );
}
