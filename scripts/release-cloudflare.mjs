import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
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
    const cli =
      name === "npm" ? npmCli : join(dirname(npmCli), "npx-cli.js");
    if (!existsSync(cli)) {
      throw new Error(`cannot locate ${name} CLI at ${cli}`);
    }
    return { executable: process.execPath, args: [cli, ...args] };
  }
  return { executable: name, args };
}

function run(executable, args, options = {}) {
  const processInvocation = invocation(executable, args);
  const result = spawnSync(processInvocation.executable, processInvocation.args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    const launchError = result.error?.message ? `: ${result.error.message}` : "";
    const detail = options.capture
      ? `${result.stdout || ""}\n${result.stderr || ""}`.trim()
      : "";
    throw new Error(
      `${executable} ${args.join(" ")} failed${launchError}${detail ? `: ${detail}` : ""}`
    );
  }
  return result.stdout || "";
}

export function validateReleaseInput(originValue, projectValue) {
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
  const project = String(projectValue || "").trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$/.test(project)) {
    throw new Error(
      "project must contain 1-58 lowercase letters, numbers, or hyphens"
    );
  }
  return { origin: origin.origin, project };
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

export function inspectDist(distDirectory, expectedOrigin) {
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
  if (ads !== "# Advertising is not enabled on this deployment.\n") {
    throw new Error("first commercial-host release must keep advertising off");
  }
  return {
    files: files.length,
    largestFile: largest ? relative(dist, largest.path) : "",
    largestFileBytes: largest?.bytes ?? 0,
    origin: expectedOrigin,
  };
}

function parseArgs(args) {
  const values = { deploy: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--deploy") values.deploy = true;
    else if (arg === "--origin" || arg === "--project") {
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
  if (start < 0 || end < start) throw new Error("Wrangler returned no JSON list");
  return JSON.parse(output.slice(start, end + 1));
}

async function verifyRemote(origin) {
  const paths = [
    "/",
    "/robots.txt",
    "/rss.xml",
    "/ads.txt",
    "/tools/csv-preview/",
  ];
  const results = [];
  for (const path of paths) {
    const response = await fetch(`${origin}${path}`, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`remote verification failed for ${path}: ${response.status}`);
    }
    const body = await response.text();
    if (path === "/" && !body.includes(`<link rel="canonical" href="${origin}/">`)) {
      throw new Error("remote homepage canonical does not match the release origin");
    }
    if (
      path === "/ads.txt" &&
      body !== "# Advertising is not enabled on this deployment.\n"
    ) {
      throw new Error("remote ads.txt is not fail-closed");
    }
    results.push({ path, status: response.status });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    print(
      "node scripts/release-cloudflare.mjs --origin https://PROJECT.pages.dev --project PROJECT [--deploy]"
    );
    return;
  }
  const { origin, project } = validateReleaseInput(args.origin, args.project);
  const trackedChanges = run(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    { capture: true }
  ).trim();
  if (trackedChanges) {
    throw new Error("tracked workspace changes must be committed before release");
  }
  const commitHash = run("git", ["rev-parse", "HEAD"], { capture: true }).trim();
  const commitMessage = run(
    "git",
    ["log", "-1", "--pretty=%s"],
    { capture: true }
  ).trim();
  const releaseEnv = {
    ...process.env,
    PUBLIC_SITE_URL: origin,
    PUBLIC_HOSTING_PROVIDER: "cloudflare",
    PUBLIC_ADSENSE_MODE: "off",
    PUBLIC_ANALYTICS_ENABLED: "false",
    PUBLIC_COMMERCIAL_HOSTING_CONFIRMED: "false",
  };
  run("npm", ["run", "build"], { env: releaseEnv, capture: true });
  const inspection = inspectDist(join(root, "dist"), origin);

  if (!args.deploy) {
    print(
      JSON.stringify({
        status: "preflight_passed",
        project,
        commitHash,
        ...inspection,
        nextCommand: `npm run release:cloudflare -- --origin ${origin} --project ${project} --deploy`,
      })
    );
    return;
  }

  run("npx", ["--yes", "wrangler@4", "whoami"], { capture: true });
  const projects = parseJsonArray(
    run(
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
  run("npx", [
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
  const remote = await verifyRemote(origin);
  print(
    JSON.stringify({
      status: "deployed_and_verified",
      project,
      commitHash,
      ...inspection,
      remote,
    })
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    printError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
