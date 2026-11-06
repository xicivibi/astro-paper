import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseYaml } from "./mini-yaml.mjs";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/;

/**
 * Splits a Markdown document into parsed frontmatter and body.
 * @param {string} source
 */
export function parsePostSource(source) {
  const text = source.replace(/^\uFEFF/, "");
  const match = frontmatterPattern.exec(text);
  if (!match) throw new Error("missing frontmatter block");
  const data = parseYaml(match[1]) ?? {};
  if (typeof data !== "object" || Array.isArray(data)) {
    throw new Error("frontmatter must be a mapping");
  }
  return { data, body: match[2] };
}

/**
 * Reads every post the Astro glob loader would load (`**\/[^_]*.{md,mdx}`).
 * @param {string} postsDirectory
 */
export function readPosts(postsDirectory) {
  /** @type {{ file: string, slug: string, data: Record<string, any>, body: string }[]} */
  const posts = [];
  /** @param {string} directory */
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (/^[^_].*\.mdx?$/.test(entry.name)) {
        const file = relative(postsDirectory, path).split(sep).join("/");
        const { data, body } = parsePostSource(readFileSync(path, "utf8"));
        posts.push({ file, slug: file.replace(/\.mdx?$/, ""), data, body });
      }
    }
  };
  walk(postsDirectory);
  return posts.sort((a, b) => a.file.localeCompare(b.file));
}

/** @param {Record<string, any>} data */
export function isPublicPost(data) {
  return data.draft !== true && data.editorialStatus !== "legacy_hold";
}
