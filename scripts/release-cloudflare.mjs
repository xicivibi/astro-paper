import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "index.html",
  "robots.txt",
  "rss.xml",
  "sitemap-index.xml",
  "ads.txt",
  "_headers",
  "tools/csv-preview/index.html",
];
const textExtensions = /\.(?:html|xml|txt)$/i;
const maxFiles = 20_000;
const maxFileBytes = 25 * 1024 * 1024;
const productionRepository = "https://github.com/xicivibi/astro-paper.git";
const releaseMarker = "/.well-known/xici-release.json";
const adsLinePattern =
  /^google\.com, pub-[0-9]{16}, DIRECT, f08c47fec0942fa0\n$/;

function print(value) {
  process.stdout.write(`${value}\n`);
}

function printError(value) {
  process.stderr.write(`${value}\n`);
}

function invocation(name, args) {
  if (process.platform === "win32" && (name === "npm" || name === "npx")) {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) {
      throw new Error("npm_execpath is required for a Windows release");
    }
    const cli = name === "npm" ? npmCli : join(dirname(npmCli), "npx-cli.js");
    if (!existsSync(cli)) {
      throw new Error(`cannot locate ${name} CLI at ${cli}`);
    }
    return { executable: process.execPath, args: [cli, ...args] };
  }
  return { executable: name, args };
}

function run(executable, args, options = {}) {
  const processInvocation = invocation(executable, args);
  const result = spawnSync(
    processInvocation.executable,
    processInvocation.args,
    {
      cwd: root,
      encoding: "utf8",
      stdio: options.capture ? "pipe" : "inherit",
      env: options.env ?? process.env,
    }
  );
  if (result.status !== 0) {
    const launchError = result.error?.message
      ? `: ${result.error.message}`
      : "";
    const detail = options.capture
      ? `${result.stdout || ""}\n${result.stderr || ""}`.trim()
      : "";
    throw new Error(
      `${executable} ${args.join(" ")} failed${launchError}${detail ? `: ${detail}` : ""}`
    );
  }
  return result.stdout || "";
}

export const ADSENSE_MODES = Object.freeze(["off", "verify", "serve"]);
const disabledAdsTxt = "# Advertising is not enabled on this deployment.\n";
const publisherPattern = /^(?:ca-)?pub-([0-9]{16})$/;
const placeholderPublishers = new Set([
  "0000000000000000",
  "1111111111111111",
  "1234567890123456",
]);
const emailPattern =
  /^[A-Za-z0-9.!$&'*+/=`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;
const sampleEmail =
  /@(?:example\.(?:com|org|net)|test\.invalid)$|^(?:you|your|name|email|owner)@/i;

export function validateReleaseInput(
  originValue,
  projectValue,
  adsenseMode = "off"
) {
  if (!ADSENSE_MODES.includes(adsenseMode)) {
    throw new Error(`--adsense-mode must be one of ${ADSENSE_MODES.join(", ")}`);
  }
  const origin = new URL(originValue);
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("origin must be an HTTPS origin without a path");
  }
  if (
    origin.hostname === "localhost" ||
    origin.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("origin must be the account-owned commercial host");
  }
  const warnings = [];
  if (origin.hostname.endsWith(".pages.dev")) {
    if (adsenseMode !== "off") {
      throw new Error(
        "AdSense cannot add a shared pages.dev subdomain; release verify mode on an owned domain"
      );
    }
    warnings.push(
      "pages.dev origin: AdSense site addition is not possible on a shared subdomain; use an owned domain before verify mode"
    );
  }
  const project = String(projectValue || "").trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(project)) {
    throw new Error(
      "project must contain 1-58 lowercase letters, numbers, or hyphens"
    );
  }
  return { origin: origin.origin, project, adsenseMode, warnings };
}

/**
 * Build variables for one release. The publisher ID is read from the
 * environment only and is never echoed back in output or errors.
 * @param {string} origin
 * @param {string} adsenseMode
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string | undefined>}
 */
export function releaseBuildEnv(origin, adsenseMode, env = process.env) {
  const base = {
    ...env,
    PUBLIC_SITE_URL: origin,
    PUBLIC_HOSTING_PROVIDER: "cloudflare",
    PUBLIC_ANALYTICS_ENABLED: "false",
  };
  if (adsenseMode === "off") {
    return {
      ...base,
      PUBLIC_ADSENSE_MODE: "off",
      PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "false",
    };
  }
  const match = publisherPattern.exec(
    String(env.PUBLIC_ADSENSE_PUBLISHER_ID || "").trim()
  );
  if (!match || placeholderPublishers.has(match[1])) {
    throw new Error(
      "verify mode requires a real PUBLIC_ADSENSE_PUBLISHER_ID in the environment"
    );
  }
  if (env.PUBLIC_COMMERCIAL_HOSTING_CONFIRMED !== "true") {
    throw new Error(
      "verify mode requires PUBLIC_COMMERCIAL_HOSTING_CONFIRMED=true set by the owner"
    );
  }
  const email = String(
    env.PUBLIC_OPERATOR_EMAIL ?? env.PUBLIC_CONTACT_EMAIL ?? ""
  ).trim();
  if (!emailPattern.test(email) || sampleEmail.test(email)) {
    throw new Error("verify mode requires a real PUBLIC_OPERATOR_EMAIL");
  }
  if (adsenseMode === "serve" && env.PUBLIC_ADSENSE_CMP !== "google") {
    throw new Error(
      "serve mode requires PUBLIC_ADSENSE_CMP=google after the Privacy & messaging consent message is published"
    );
  }
  return {
    ...base,
    PUBLIC_ADSENSE_MODE: adsenseMode,
    PUBLIC_ADSENSE_PUBLISHER_ID: `pub-${match[1]}`,
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "true",
  };
}

/** @param {string} root */
export function readDeployMethod(root) {
  const path = join(root, "deploy", "deploy-method.json");
  const method = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8")).method
    : "undecided";
  if (!["undecided", "direct-upload", "git-integration"].includes(method)) {
    throw new Error(
      "deploy/deploy-method.json method must be undecided, direct-upload, or git-integration"
    );
  }
  return method;
}

export function verifyProductionSource(commitHash, execute = run) {
  if (!/^[a-f0-9]{40}$/.test(commitHash)) {
    throw new Error("release commit must be a full Git SHA");
  }
  const git = args => execute("git", args, { capture: true }).trim();
  if (git(["status", "--porcelain", "--untracked-files=normal"])) {
    throw new Error(
      "production release requires a clean worktree including untracked files"
    );
  }
  if (git(["rev-parse", "HEAD"]) !== commitHash) {
    throw new Error("release HEAD changed during the build");
  }
  // Query the canonical repository, not a possibly stale origin/main ref or
  // a local origin that points at a fork. Network errors stop deployment.
  const remote = git([
    "ls-remote",
    "--exit-code",
    productionRepository,
    "refs/heads/main",
  ]);
  const match = /^([a-f0-9]{40})\s+refs\/heads\/main$/.exec(remote);
  if (!match || match[1] !== commitHash) {
    throw new Error(
      "production release must match current xicivibi/astro-paper main"
    );
  }
  return { repository: productionRepository, branch: "main", commitHash };
}

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export function inspectDist(distDirectory, expectedOrigin, adsenseMode = "off") {
  const dist = resolve(distDirectory);
  for (const file of requiredFiles) {
    if (!existsSync(join(dist, file))) {
      throw new Error(`missing release artifact: ${file}`);
    }
  }
  const files = listFiles(dist);
  if (files.length > maxFiles) {
    throw new Error(`release has ${files.length} files; limit is ${maxFiles}`);
  }
  const largest = files
    .map(path => ({ path, bytes: statSync(path).size }))
    .sort((a, b) => b.bytes - a.bytes)[0];
  if (largest?.bytes > maxFileBytes) {
    throw new Error(
      `release artifact exceeds 25 MiB: ${relative(dist, largest.path)}`
    );
  }
  const text = files
    .filter(path => textExtensions.test(path))
    .map(path => readFileSync(path, "utf8"))
    .join("\n");
  if (text.includes("https://xici.vercel.app")) {
    throw new Error("release still contains the Vercel production origin");
  }
  const home = readFileSync(join(dist, "index.html"), "utf8");
  const robots = readFileSync(join(dist, "robots.txt"), "utf8");
  const sitemap = readFileSync(join(dist, "sitemap-index.xml"), "utf8");
  const rss = readFileSync(join(dist, "rss.xml"), "utf8");
  const ads = readFileSync(join(dist, "ads.txt"), "utf8");
  if (!home.includes(`<link rel="canonical" href="${expectedOrigin}/">`)) {
    throw new Error("homepage canonical does not match the release origin");
  }
  if (!robots.includes(`Sitemap: ${expectedOrigin}/sitemap-index.xml`)) {
    throw new Error("robots sitemap does not match the release origin");
  }
  if (!sitemap.includes(`${expectedOrigin}/sitemap-0.xml`)) {
    throw new Error("sitemap index does not match the release origin");
  }
  if (!rss.includes(`<link>${expectedOrigin}/</link>`)) {
    throw new Error("RSS channel does not match the release origin");
  }
  if (adsenseMode === "off" && ads !== disabledAdsTxt) {
    throw new Error("an off-mode release must keep advertising off");
  }
  if (adsenseMode !== "off" && !adsLinePattern.test(ads)) {
    throw new Error("a verify-mode release needs a one-line publisher ads.txt");
  }
  if (adsenseMode === "serve") {
    const headers = readFileSync(join(dist, "_headers"), "utf8");
    if (!/script-src 'self' 'sha256-[^']+'/.test(headers)) {
      throw new Error("a serve-mode release needs the generated hash-based CSP");
    }
  }
  return {
    files: files.length,
    largestFile: largest ? relative(dist, largest.path) : "",
    largestFileBytes: largest?.bytes ?? 0,
    origin: expectedOrigin,
  };
}

export function parseArgs(args) {
  const values = { deploy: false, adsenseMode: "off" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--deploy") values.deploy = true;
    else if (arg === "--adsense-mode") {
      values.adsenseMode = args[index + 1];
      index += 1;
    } else if (arg === "--origin" || arg === "--project") {
      values[arg.slice(2)] = args[index + 1];
      index += 1;
    } else if (arg === "--help") values.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return values;
}

function parseJsonArray(output) {
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end < start)
    throw new Error("Wrangler returned no JSON list");
  return JSON.parse(output.slice(start, end + 1));
}

export async function verifyRemote(
  origin,
  commitHash,
  fetcher = fetch,
  adsenseMode = "off"
) {
  const paths = [
    releaseMarker,
    "/",
    "/robots.txt",
    "/rss.xml",
    "/ads.txt",
    "/tools/csv-preview/",
  ];
  const results = [];
  for (const path of paths) {
    const response = await fetcher(`${origin}${path}`, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new Error(
        `remote verification failed for ${path}: ${response.status}`
      );
    }
    const body = await response.text();
    if (path === releaseMarker) {
      const marker = JSON.parse(body);
      if (marker.commitHash !== commitHash || marker.origin !== origin) {
        throw new Error(
          "remote release identity does not match the deployed commit and origin"
        );
      }
    }
    if (
      path === "/" &&
      !body.includes(`<link rel="canonical" href="${origin}/">`)
    ) {
      throw new Error(
        "remote homepage canonical does not match the release origin"
      );
    }
    if (path === "/ads.txt") {
      if (adsenseMode === "off" && body !== disabledAdsTxt) {
        throw new Error("remote ads.txt is not fail-closed");
      }
      if (adsenseMode !== "off" && !adsLinePattern.test(body)) {
        throw new Error("remote ads.txt does not carry the publisher line");
      }
    }
    results.push({ path, status: response.status });
  }
  return results;
}

/**
 * Runs one release. Every side effect goes through `deps` so tests can run
 * the whole preflight with mocked processes, files and network.
 * @param {string[]} argv
 * @param {Record<string, any>} [deps]
 * @returns {Promise<Record<string, any>>}
 */
export async function runRelease(argv, deps = {}) {
  const execute = deps.run ?? run;
  const fetcher = deps.fetcher ?? fetch;
  const env = deps.env ?? process.env;
  const projectRoot = deps.root ?? root;
  const distDirectory = deps.distDir ?? join(projectRoot, "dist");
  const out = deps.print ?? print;
  const writeMarker =
    deps.writeMarker ??
    ((directory, body) => {
      mkdirSync(join(directory, ".well-known"), { recursive: true });
      writeFileSync(join(directory, releaseMarker.slice(1)), body);
    });
  const readiness =
    deps.readiness ??
    (async (distDir, mode, origin) => {
      const { evaluateReadiness } = await import("./adsense-readiness.mjs");
      const { checkPostDirectory } = await import("./check-post-quality.mjs");
      return evaluateReadiness({
        distDir,
        mode,
        origin,
        env,
        gate: checkPostDirectory(join(projectRoot, "src", "content", "posts")),
      });
    });

  const args = parseArgs(argv);
  if (args.help) {
    out(
      "node scripts/release-cloudflare.mjs --origin https://YOUR-DOMAIN --project PROJECT [--adsense-mode off|verify] [--deploy]"
    );
    return { status: "help" };
  }
  const { origin, project, adsenseMode, warnings } = validateReleaseInput(
    args.origin,
    args.project,
    args.adsenseMode
  );
  for (const warning of warnings) printError(`warning: ${warning}`);
  const releaseEnv = releaseBuildEnv(origin, adsenseMode, env);
  const deployMethod = readDeployMethod(projectRoot);
  if (args.deploy && deployMethod !== "direct-upload") {
    throw new Error(
      deployMethod === "git-integration"
        ? "deploy/deploy-method.json selects Cloudflare Git integration: Cloudflare builds main itself, so do not upload with this script"
        : "choose the deployment method in deploy/deploy-method.json (direct-upload or git-integration) before --deploy"
    );
  }
  const trackedChanges = execute(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { capture: true }
  ).trim();
  if (trackedChanges) {
    throw new Error(
      "tracked workspace changes must be committed before release"
    );
  }
  const commitHash = execute("git", ["rev-parse", "HEAD"], {
    capture: true,
  }).trim();
  if (args.deploy) verifyProductionSource(commitHash, execute);
  const commitMessage = execute("git", ["log", "-1", "--pretty=%s"], {
    capture: true,
  }).trim();
  execute("npm", ["run", "build"], { env: releaseEnv, capture: true });
  writeMarker(distDirectory, JSON.stringify({ commitHash, origin }) + "\n");
  const inspection = inspectDist(distDirectory, origin, adsenseMode);
  let readinessSummary = null;
  if (adsenseMode !== "off") {
    const result = await readiness(distDirectory, adsenseMode, origin);
    readinessSummary = {
      ready: result.ready,
      failing: result.checks
        .filter(check => !check.pass)
        .map(check => check.id),
    };
    if (!result.ready) {
      throw new Error(
        `AdSense readiness failed: ${readinessSummary.failing.join(", ")}`
      );
    }
  }

  if (!args.deploy) {
    const summary = {
      status: "preflight_passed",
      project,
      adsenseMode,
      deployMethod,
      commitHash,
      productionSourceVerified: false,
      warnings,
      readiness: readinessSummary,
      ...inspection,
      nextCommand: `npm run release:cloudflare -- --origin ${origin} --project ${project} --adsense-mode ${adsenseMode} --deploy`,
    };
    out(JSON.stringify(summary));
    return summary;
  }

  execute("npx", ["--yes", "wrangler@4", "whoami"], { capture: true });
  const projects = parseJsonArray(
    execute(
      "npx",
      ["--yes", "wrangler@4", "pages", "project", "list", "--json"],
      { capture: true }
    )
  );
  if (!projects.some(item => item?.name === project)) {
    throw new Error(
      `Cloudflare Pages project '${project}' does not exist in the authenticated account`
    );
  }
  // Recheck after the build and account lookups so a changed main/HEAD cannot
  // be published under the SHA captured before the build.
  const source = verifyProductionSource(commitHash, execute);
  execute("npx", [
    "--yes",
    "wrangler@4",
    "pages",
    "deploy",
    "dist",
    "--project-name",
    project,
    "--branch",
    "main",
    "--commit-hash",
    commitHash,
    "--commit-message",
    commitMessage,
    "--commit-dirty=false",
  ]);
  const remote = await verifyRemote(origin, commitHash, fetcher, adsenseMode);
  const summary = {
    status: "deployed_and_verified",
    project,
    adsenseMode,
    commitHash,
    source,
    ...inspection,
    remote,
  };
  out(JSON.stringify(summary));
  return summary;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runRelease(process.argv.slice(2)).catch(error => {
    printError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
