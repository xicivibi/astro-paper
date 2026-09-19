import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveHosting } from "../src/config/hosting.ts";
import {
  inspectDist,
  validateReleaseInput,
} from "../scripts/release-cloudflare.mjs";

test("hosting disclosure follows the configured or inferred provider", () => {
  assert.equal(
    resolveHosting("https://xici.vercel.app/", {}).provider,
    "vercel"
  );
  assert.equal(
    resolveHosting("https://xici.pages.dev/", {}).provider,
    "cloudflare"
  );
  assert.equal(
    resolveHosting("https://blog.example.com/", {
      PUBLIC_HOSTING_PROVIDER: "cloudflare",
    }).name,
    "Cloudflare"
  );
  assert.throws(
    () =>
      resolveHosting("https://blog.example.com/", {
        PUBLIC_HOSTING_PROVIDER: "guess",
      }),
    /must be vercel, cloudflare, or other/
  );
});

test("Cloudflare release input rejects the current non-commercial origin", () => {
  assert.deepEqual(
    validateReleaseInput("https://xici-example.pages.dev", "xici-example"),
    { origin: "https://xici-example.pages.dev", project: "xici-example" }
  );
  assert.throws(
    () => validateReleaseInput("https://xici.vercel.app", "xici"),
    /commercial host/
  );
  assert.throws(
    () => validateReleaseInput("https://xici.pages.dev/blog", "xici"),
    /without a path/
  );
  assert.throws(
    () => validateReleaseInput("https://xici.pages.dev", "Bad_Project"),
    /project must contain/
  );
});

test("release inspection binds all discovery files and keeps ads off", () => {
  const origin = "https://xici-example.pages.dev";
  const directory = join(tmpdir(), `xici-release-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(join(directory, "tools/csv-preview"), { recursive: true });
    writeFileSync(
      join(directory, "index.html"),
      `<link rel="canonical" href="${origin}/">`
    );
    writeFileSync(
      join(directory, "robots.txt"),
      `Sitemap: ${origin}/sitemap-index.xml`
    );
    writeFileSync(
      join(directory, "sitemap-index.xml"),
      `<loc>${origin}/sitemap-0.xml</loc>`
    );
    writeFileSync(
      join(directory, "rss.xml"),
      `<channel><link>${origin}/</link></channel>`
    );
    writeFileSync(
      join(directory, "ads.txt"),
      "# Advertising is not enabled on this deployment.\n"
    );
    writeFileSync(
      join(directory, "tools/csv-preview/index.html"),
      "<h1>CSV</h1>"
    );
    writeFileSync(
      join(directory, "_headers"),
      "/*\n  Content-Security-Policy: default-src 'self'\n"
    );
    const result = inspectDist(directory, origin);
    assert.equal(result.files, 7);

    writeFileSync(join(directory, "rss.xml"), "https://xici.vercel.app/rss.xml");
    assert.throws(
      () => inspectDist(directory, origin),
      /still contains the Vercel production origin/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("both hosts ship the same restrictive security policy", () => {
  const root = new URL("..", import.meta.url);
  const cloudflare = readFileSync(
    new URL("deploy/cloudflare-headers", root),
    "utf8"
  );
  const vercel = JSON.parse(
    readFileSync(new URL("vercel.json", root), "utf8")
  );
  const headers = Object.fromEntries(
    vercel.headers[0].headers.map(
      (item: { key: string; value: string }) => [item.key, item.value]
    )
  );

  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) {
    assert.match(cloudflare, new RegExp(directive.replaceAll("'", "\\'")));
    assert.match(headers["Content-Security-Policy"], new RegExp(directive.replaceAll("'", "\\'")));
  }
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
});
