import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  inspectDist,
  releaseBuildEnv,
  runRelease,
} from "../scripts/release-cloudflare.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sha = "c".repeat(40);
const publisherId = "pub-9876543210987654";

function fixtureDist(origin: string, ads: string) {
  const dir = mkdtempSync(join(tmpdir(), "xici-release-flow-"));
  const write = (path: string, body: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), body);
  };
  write("index.html", `<link rel="canonical" href="${origin}/">`);
  write("robots.txt", `Sitemap: ${origin}/sitemap-index.xml`);
  write("sitemap-index.xml", `<loc>${origin}/sitemap-0.xml</loc>`);
  write("rss.xml", `<channel><link>${origin}/</link></channel>`);
  write("ads.txt", ads);
  write("_headers", "/*\n  X-Frame-Options: DENY\n");
  write("tools/csv-preview/index.html", "<h1>CSV</h1>");
  return dir;
}

function mockRun() {
  const calls: { command: string; args: string[]; env?: NodeJS.ProcessEnv }[] =
    [];
  const run = (
    command: string,
    args: string[],
    options: { env?: NodeJS.ProcessEnv } = {}
  ) => {
    calls.push({ command, args, env: options.env });
    if (args[0] === "status") return "";
    if (args[0] === "rev-parse") return sha;
    if (args[0] === "log") return "Release candidate";
    return "";
  };
  return { calls, run };
}

const quiet = () => {};

test("preflight runs only mocked git/build calls and never wrangler or fetch", async () => {
  const origin = "https://example-test.invalid";
  const dist = fixtureDist(
    origin,
    "# Advertising is not enabled on this deployment.\n"
  );
  const { calls, run } = mockRun();
  let fetches = 0;
  try {
    const summary = await runRelease(
      ["--origin", origin, "--project", "test"],
      {
        run,
        fetcher: async () => {
          fetches += 1;
          return new Response("");
        },
        env: {},
        root: projectRoot,
        distDir: dist,
        print: quiet,
      }
    );
    assert.equal(summary.status, "preflight_passed");
    assert.equal(summary.adsenseMode, "off");
    assert.equal(fetches, 0);
    assert.equal(
      calls.filter(call => call.args.some(arg => /wrangler/.test(arg))).length,
      0
    );
    assert.deepEqual(
      calls.map(call => `${call.command} ${call.args[0]}`),
      ["git status", "git rev-parse", "git log", "npm run"]
    );
    const buildEnv = calls.at(-1)?.env ?? {};
    assert.equal(buildEnv.PUBLIC_ADSENSE_MODE, "off");
    assert.equal(buildEnv.PUBLIC_SITE_URL, origin);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("verify mode needs a publisher ID, owner hosting confirmation and email", () => {
  const origin = "https://xici-site.kr";
  assert.throws(
    () => releaseBuildEnv(origin, "verify", {}),
    /PUBLIC_ADSENSE_PUBLISHER_ID/
  );
  assert.throws(
    () =>
      releaseBuildEnv(origin, "verify", {
        PUBLIC_ADSENSE_PUBLISHER_ID: "pub-1234567890123456",
        PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
        PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr",
      }),
    /PUBLIC_ADSENSE_PUBLISHER_ID/
  );
  assert.throws(
    () =>
      releaseBuildEnv(origin, "verify", {
        PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
        PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr",
      }),
    /COMMERCIAL_HOSTING_CONFIRMED/
  );
  assert.throws(
    () =>
      releaseBuildEnv(origin, "verify", {
        PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
        PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
      }),
    /PUBLIC_OPERATOR_EMAIL/
  );
  const env = releaseBuildEnv(origin, "verify", {
    PUBLIC_ADSENSE_PUBLISHER_ID: `ca-${publisherId}`,
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
    PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr",
  });
  assert.equal(env.PUBLIC_ADSENSE_MODE, "verify");
  assert.equal(env.PUBLIC_ADSENSE_PUBLISHER_ID, publisherId);
  // Off mode never forwards an ambient publisher ID into an ad build.
  const off = releaseBuildEnv(origin, "off", {
    PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
  });
  assert.equal(off.PUBLIC_ADSENSE_MODE, "off");
  assert.equal(off.PUBLIC_COMMERCIAL_HOSTING_CONFIRMED, "false");
});

test("verify releases stop on readiness gaps without printing the publisher ID", async () => {
  const origin = "https://xici-site.kr";
  const dist = fixtureDist(
    origin,
    `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
  );
  const { calls, run } = mockRun();
  const printed: string[] = [];
  const env = {
    PUBLIC_ADSENSE_PUBLISHER_ID: publisherId,
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
    PUBLIC_OPERATOR_EMAIL: "contact@xici-site.kr",
  };
  try {
    await assert.rejects(
      runRelease(
        ["--origin", origin, "--project", "xici", "--adsense-mode", "verify"],
        {
          run,
          env,
          root: projectRoot,
          distDir: dist,
          print: (line: string) => printed.push(line),
          readiness: async () => ({
            ready: false,
            checks: [{ id: "public-posts", pass: false }],
          }),
        }
      ),
      (error: Error) => {
        assert.match(error.message, /AdSense readiness failed: public-posts/);
        assert.doesNotMatch(error.message, /9876543210987654/);
        return true;
      }
    );
    assert.equal(calls.at(-1)?.env?.PUBLIC_ADSENSE_MODE, "verify");

    const ready = await runRelease(
      ["--origin", origin, "--project", "xici", "--adsense-mode", "verify"],
      {
        run,
        env,
        root: projectRoot,
        distDir: dist,
        print: (line: string) => printed.push(line),
        readiness: async () => ({ ready: true, checks: [] }),
      }
    );
    assert.equal(ready.status, "preflight_passed");
    assert.doesNotMatch(printed.join("\n"), /9876543210987654/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("pages.dev cannot be released in verify mode", async () => {
  const { calls, run } = mockRun();
  await assert.rejects(
    runRelease(
      [
        "--origin",
        "https://xici.pages.dev",
        "--project",
        "xici",
        "--adsense-mode",
        "verify",
      ],
      { run, env: {}, root: projectRoot, print: quiet }
    ),
    /pages\.dev/
  );
  assert.equal(calls.length, 0);
});

test("--deploy is refused until the owner chooses direct upload", async () => {
  const root = mkdtempSync(join(tmpdir(), "xici-deploy-method-"));
  try {
    for (const method of ["undecided", "git-integration"]) {
      mkdirSync(join(root, "deploy"), { recursive: true });
      writeFileSync(
        join(root, "deploy", "deploy-method.json"),
        JSON.stringify({ method })
      );
      const { calls, run } = mockRun();
      await assert.rejects(
        runRelease(
          ["--origin", "https://xici-site.kr", "--project", "xici", "--deploy"],
          { run, env: {}, root, print: quiet }
        ),
        /deploy-method\.json/
      );
      assert.equal(calls.length, 0, method);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("custom-origin inspection binds canonical, sitemap, robots, RSS and ads.txt", () => {
  const origin = "https://xici-site.kr";
  const verifyDist = fixtureDist(
    origin,
    `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
  );
  try {
    assert.equal(inspectDist(verifyDist, origin, "verify").origin, origin);
    assert.throws(
      () => inspectDist(verifyDist, origin, "off"),
      /keep advertising off/
    );
    assert.throws(
      () => inspectDist(verifyDist, "https://other-site.kr", "verify"),
      /canonical/
    );
    writeFileSync(join(verifyDist, "ads.txt"), "# off\n");
    assert.throws(
      () => inspectDist(verifyDist, origin, "verify"),
      /publisher ads\.txt/
    );
  } finally {
    rmSync(verifyDist, { recursive: true, force: true });
  }
});
