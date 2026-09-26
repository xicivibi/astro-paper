import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";

const supported = new Set([
  ".astro", ".css", ".html", ".js", ".json", ".md",
  ".mjs", ".ts", ".tsx", ".yaml", ".yml",
]);

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", shell: false });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "Git comparison failed.\n");
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

const base = process.env.FORMAT_BASE_SHA || git(["rev-parse", "HEAD^"]);
git(["rev-parse", "--verify", `${base}^{commit}`]);
const changed = spawnSync(
  "git",
  ["diff", "--name-only", "--diff-filter=ACMRT", "-z", base, "HEAD"],
  { encoding: "utf8", shell: false }
);
if (changed.status !== 0) {
  process.stderr.write(changed.stderr || "Changed-file discovery failed.\n");
  process.exit(changed.status || 1);
}
const files = changed.stdout
  .split("\0")
  .filter(file => file && supported.has(extname(file)) && existsSync(file));
if (files.length === 0) {
  process.stdout.write("No changed Prettier-supported files.\n");
  process.exit(0);
}
const prettier = resolve("node_modules/prettier/bin/prettier.cjs");
const result = spawnSync(
  process.execPath,
  [prettier, "--check", "--ignore-unknown", ...files],
  { stdio: "inherit", shell: false }
);
process.exit(result.status ?? 1);
