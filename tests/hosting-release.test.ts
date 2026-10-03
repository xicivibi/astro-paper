import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveHosting } from "../src/config/hosting.ts";
import {
  inspectDist,
  validateReleaseInput,
  verifyProductionSource,
  verifyRemote,
} from "../scripts/release-cloudflare.mjs";

test("production source requires a clean exact current canonical main", () => {
  const sha = "a".repeat(40);
  const calls: string[][] = [];
  const execute = (_command: string, args: string[]) => {
    calls.push(args);
    if (args[0] === "status") return "";
    if (args[0] === "rev-parse") return sha;
    return `${sha}\trefs/heads/main\n`;
  };
  assert.equal(verifyProductionSource(sha, execute).commitHash, sha);
  assert.deepEqual(calls[2], [
    "ls-remote",
    "--exit-code",
    "https://github.com/xicivibi/astro-paper.git",
    "refs/heads/main",
  ]);
  for (const dirty of [" M src/config.ts", "?? public/unreviewed.html"]) {
    assert.throws(
      () => verifyProductionSource(sha, () => dirty),
      /clean worktree/
    );
  }
  assert.throws(
    () =>
      verifyProductionSource(sha, (_: string, args: string[]) => {
        return args[0] === "status" ? "" : "b".repeat(40);
      }),
    /HEAD changed/
  );
  for (const remote of [
    "",
    `${"b".repeat(40)}\trefs/heads/main`,
    `${sha}\trefs/heads/feature`,
  ]) {
    assert.throws(
      () =>
        verifyProductionSource(sha, (command: string, args: string[]) => {
          return args[0] === "ls-remote" ? remote : execute(command, args);
        }),
      /current xicivibi/
    );
  }
  assert.throws(
    () =>
      verifyProductionSource(sha, (command: string, args: string[]) => {
        if (args[0] === "ls-remote") throw new Error("network unavailable");
        return execute(command, args);
      }),
    /network unavailable/
  );
});

test("remote verification rejects stale releases even when the homepage is healthy", async () => {
  const origin = "https://xici-example.pages.dev";
  const sha = "a".repeat(40);
  const fetcher: typeof fetch = async (input, options) => {
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    const body = path.endsWith("xici-release.json")
      ? JSON.stringify({ commitHash: sha, origin })
      : path === "/"
        ? `<link rel="canonical" href="${origin}/">`
        : path === "/ads.txt"
          ? "# Advertising is not enabled on this deployment.\n"
          : "ok";
    return new Response(body);
  };
  assert.equal((await verifyRemote(origin, sha, fetcher)).length, 6);
  await assert.rejects(
    verifyRemote(origin, "b".repeat(40), fetcher),
    /release identity/
  );
  await assert.rejects(
    verifyRemote(origin, sha, async () => new Response("{}")),
    /release identity/
  );
});

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

    writeFileSync(
      join(directory, "rss.xml"),
      "https://xici.vercel.app/rss.xml"
    );
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
  const vercel = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
  const headers = Object.fromEntries(
    vercel.headers[0].headers.map((item: { key: string; value: string }) => [
      item.key,
      item.value,
    ])
  );

  for (const directive of [
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ]) {
    assert.match(cloudflare, new RegExp(directive.replaceAll("'", "\\'")));
    assert.match(
      headers["Content-Security-Policy"],
      new RegExp(directive.replaceAll("'", "\\'"))
    );
  }
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
});
