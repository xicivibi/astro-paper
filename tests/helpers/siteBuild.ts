import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const astroBin = join(projectRoot, "node_modules", "astro", "bin", "astro.mjs");

export type SiteBuild = {
  status: number | null;
  output: string;
  outDir: string;
  read: (path: string) => string;
  htmlFiles: () => string[];
  cleanup: () => void;
};

/**
 * Runs `astro build` into a private temporary directory with only the given
 * PUBLIC_* variables, so ambient developer configuration cannot leak in.
 * No network access is needed: the site is static and fully local.
 */
export function buildSite(env: Record<string, string>): SiteBuild {
  const outDir = mkdtempSync(join(tmpdir(), "xici-dist-"));
  const baseEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("PUBLIC_"))
  );
  const result = spawnSync(
    process.execPath,
    [astroBin, "build", "--outDir", outDir],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...baseEnv, ...env },
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  const listHtml = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listHtml(path);
      return entry.name.endsWith(".html") ? [path] : [];
    });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    outDir,
    read: path => readFileSync(join(outDir, path), "utf8"),
    htmlFiles: () =>
      listHtml(outDir).map(path => relative(outDir, path).split(sep).join("/")),
    cleanup: () => rmSync(outDir, { recursive: true, force: true }),
  };
}
