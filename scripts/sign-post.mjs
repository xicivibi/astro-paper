#!/usr/bin/env node
// Explicit owner invocation only; importing this module never signs a post.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePosts,
  GATE_START,
  MACHINE_SIGNER,
  MAX_POSTS_PER_7_DAYS,
  PLACEHOLDER_SIGNER,
  readableLength,
} from "./check-post-quality.mjs";
import { MIN_PUBLIC_POSTS } from "./adsense-readiness.mjs";
import { isPublicPost, parsePostSource, readPosts } from "./lib/posts.mjs";
import {
  buildSigningKit,
  privacyCheck,
  readRegular,
} from "./lib/signing-kit.mjs";

const DAY = 86400000;
const KST = 9 * 60 * 60 * 1000;
const kstDay = now => new Date(now.getTime() + KST).toISOString().slice(0, 10);
const kstTimestamp = now =>
  new Date(now.getTime() + KST).toISOString().slice(0, 19) + "+09:00";

/** Every gate window is [t, t + 7 days); exactly seven days later is outside. */
export function selectPublicationDate(posts, now, requested) {
  const today = kstDay(now);
  if (
    requested &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(requested) ||
      !Number.isFinite(Date.parse(requested)) ||
      new Date(requested).toISOString().slice(0, 10) !== requested ||
      requested < today)
  ) {
    throw new Error("--date must be a real YYYY-MM-DD on or after today (KST)");
  }
  const times = posts
    .filter(p => isPublicPost(p.data))
    .map(p => Date.parse(p.data.pubDatetime))
    .filter(t => Number.isFinite(t) && t >= Date.parse(GATE_START));
  const allows = candidate => {
    const sorted = [...times, candidate].sort((a, b) => a - b);
    return sorted.every(
      (start, i) =>
        sorted[i + MAX_POSTS_PER_7_DAYS] === undefined ||
        sorted[i + MAX_POSTS_PER_7_DAYS] >= start + 7 * DAY
    );
  };
  if (
    times.some(
      start =>
        times.filter(t => t >= start && t < start + 7 * DAY).length >
        MAX_POSTS_PER_7_DAYS
    )
  ) {
    throw new Error(
      "Existing public posts violate pace; resolve their schedule first"
    );
  }
  let time = Date.parse(`${requested ?? today}T09:00:00+09:00`);
  if (!requested) time = Math.max(time, now.getTime());
  while (!allows(time)) {
    if (requested)
      throw new Error(
        `Requested date violates pace: maximum ${MAX_POSTS_PER_7_DAYS} posts per rolling 7 days`
      );
    time += DAY;
  }
  return kstTimestamp(new Date(time));
}

function parseArguments(args) {
  const options = {};
  const valueFlags = new Set(["--name", "--note", "--date"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (
      valueFlags.has(arg) ||
      ["--status", "--dry-run", "--kit-only"].includes(arg)
    ) {
      if (arg in options) throw new Error(`Duplicate option: ${arg}`);
      if (valueFlags.has(arg)) {
        if (args[i + 1] === undefined || args[i + 1].startsWith("--"))
          throw new Error(`Missing value for ${arg}`);
        options[arg] = args[++i];
      } else options[arg] = true;
    } else if (!arg.startsWith("-") && !options.slug) options.slug = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options["--status"]) {
    if (Object.keys(options).length !== 1)
      throw new Error("--status cannot be combined with other arguments");
    return options;
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/.test(options.slug ?? ""))
    throw new Error("A safe post slug is required");
  if (options["--kit-only"]) {
    if (["--name", "--note", "--date"].some(k => k in options))
      throw new Error("--kit-only cannot change signature, note or date");
  } else {
    const name = options["--name"]?.trim();
    if (
      !name ||
      name.length > 120 ||
      /[\r\n\u0000-\u001f]/.test(name) ||
      PLACEHOLDER_SIGNER.test(name) ||
      MACHINE_SIGNER.test(name)
    ) {
      throw new Error(
        "--name requires a non-placeholder human signer (no machine/AI names)"
      );
    }
    options["--name"] = name;
  }
  if ("--note" in options) {
    const note = options["--note"].trim();
    if (
      !note ||
      /[\r\n\u0000-\u001f]/.test(note) ||
      (note.match(/[.!?。！？](?:\s|$)/g) ?? []).length > 1
    )
      throw new Error("--note must be one sentence on one line");
    options["--note"] = note;
  }
  return options;
}

function updateFrontmatter(source, changes, note) {
  const match =
    /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))([\s\S]*)$/.exec(source);
  if (!match) throw new Error("Missing frontmatter");
  const newline = match[1].endsWith("\r\n") ? "\r\n" : "\n";
  const lines = match[2].split(newline);
  function setField(key, value, indent = "", from = 0, to = lines.length) {
    const pattern = new RegExp(`^${indent}(?:${key}|"${key}"|'${key}'):.*$`);
    const indices = lines
      .map((line, i) => (i >= from && i < to && pattern.test(line) ? i : -1))
      .filter(i => i >= 0);
    if (indices.length > 1)
      throw new Error(`Duplicate frontmatter key: ${key}`);
    if (!indices.length) {
      lines.splice(to, 0, `${indent}${key}: ${value}`);
      return;
    }
    const i = indices[0];
    if (lines[i + 1]?.startsWith(indent + " ") && lines[i + 1].trim())
      throw new Error(`Unsupported multiline field: ${key}`);
    lines[i] = `${indent}${key}: ${value}`;
  }
  for (const [key, value] of Object.entries(changes)) {
    if (key !== "reproductionKit") {
      setField(
        key,
        typeof value === "string" &&
          !/^(?:\d{4}-\d{2}-\d{2}T|reproduced$)/.test(value)
          ? JSON.stringify(value)
          : String(value)
      );
      continue;
    }
    const kitKeys = lines
      .map((s, i) =>
        /^(?:reproductionKit|"reproductionKit"|'reproductionKit'):/.test(s)
          ? i
          : -1
      )
      .filter(i => i >= 0);
    if (kitKeys.length > 1) throw new Error("Duplicate reproductionKit");
    let start = kitKeys[0];
    if (start === undefined) {
      start = lines.length;
      lines.push("reproductionKit:");
    }
    if (!/^reproductionKit:\s*(?:#.*)?$/.test(lines[start]))
      throw new Error("reproductionKit must be a block mapping");
    for (const [k, v] of Object.entries(value)) {
      let end = start + 1;
      while (
        end < lines.length &&
        (/^\s/.test(lines[end]) || /^#/.test(lines[end]) || !lines[end])
      )
        end++;
      setField(k, JSON.stringify(v), "  ", start + 1, end);
    }
  }
  let body = match[4];
  if (note) {
    const bodyLines = [...body.matchAll(/[^\r\n]*(?:\r?\n|$)/g)].filter(
      m => m[0]
    );
    let fence = "";
    let at;
    for (let i = 0; i < bodyLines.length; i++) {
      const text = bodyLines[i][0].trim();
      const marker = /^(?:`{3,}|~{3,})/.exec(text)?.[0];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length)
          fence = "";
        continue;
      }
      if (
        fence ||
        !text ||
        /^(?:#|>|[-*+]\s|\d+\.\s|<|!\[|\[.*\]:|\|| {4}|\t)/.test(
          bodyLines[i][0]
        )
      )
        continue;
      while (i + 1 < bodyLines.length && bodyLines[i + 1][0].trim()) i++;
      at = bodyLines[i].index + bodyLines[i][0].replace(/\r?\n$/, "").length;
      break;
    }
    if (at === undefined)
      throw new Error("No first prose paragraph for --note");
    body = body.slice(0, at) + newline + newline + note + body.slice(at);
  }
  return match[1] + lines.join(newline) + match[3] + body;
}

function assertDirectorySafe(root, target) {
  if (
    !resolve(target).startsWith(resolve(root) + "/") &&
    !resolve(target).startsWith(resolve(root) + "\\")
  )
    throw new Error("Path outside project");
  let current = target;
  while (resolve(current) !== resolve(root)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error("Refusing symbolic link directory");
    current = dirname(current);
  }
}

function treeFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap(e => {
    if (e.isSymbolicLink())
      throw new Error("Refusing symlink in kit directory");
    return e.isDirectory()
      ? treeFiles(join(directory, e.name), prefix + e.name + "/")
      : [prefix + e.name];
  });
}

function checkDestination(root, kit, slug) {
  const parent = join(root, "public/reproduction", slug);
  const destination = join(parent, kit.reference.sha256);
  const pending = join(parent, "pending");
  assertDirectorySafe(root, parent);
  if (existsSync(pending)) {
    assertDirectorySafe(root, pending);
    treeFiles(pending);
  }
  if (existsSync(destination)) {
    assertDirectorySafe(root, destination);
    const actual = treeFiles(destination).sort();
    if (
      JSON.stringify(actual) !== JSON.stringify([...kit.files.keys()].sort()) ||
      actual.some(
        p => !readRegular(join(destination, p)).equals(kit.files.get(p))
      )
    )
      throw new Error("Existing hash directory differs; refusing to overwrite");
  }
  return { parent, destination, pending };
}

function referencedImages(root, body, kit, slug) {
  const references = [
    ...body.matchAll(/\/images\/excel-lab\/[^\s)"'<>]+/g),
  ].map(m => m[0]);
  const images = new Map();
  if (!references.length) return images;
  if (
    references.some(
      path =>
        !["before.png", "after.png"].some(
          name => path === `/images/excel-lab/${slug}/${name}`
        )
    )
  )
    throw new Error("Post references an unsupported lab image");
  for (const name of ["before.png", "after.png"]) {
    const bytes = kit.files.get(`expected/${name}`);
    if (!bytes) throw new Error(`Missing validated lab image: ${name}`);
    const path = `public/images/excel-lab/${slug}/${name}`;
    const target = join(root, path);
    assertDirectorySafe(root, target);
    if (existsSync(target) && !readRegular(target).equals(bytes))
      throw new Error(
        `Existing public image differs; refusing to overwrite: ${name}`
      );
    images.set(path, bytes);
  }
  return images;
}

function commit(
  root,
  postFile,
  original,
  source,
  kit,
  slug,
  postsBefore,
  images
) {
  const { parent, destination, pending } = checkDestination(root, kit, slug);
  const stage = mkdtempSync(join(root, ".sign-post-"));
  let createdKit = false;
  let parkedPending = false;
  let preserveStage = false;
  let cleanupWarning = "";
  const createdParents = [];
  const createdImages = [];
  try {
    for (const [file, bytes] of kit.files) {
      const target = join(stage, "kit", file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
    for (const [file, bytes] of images) {
      const target = join(stage, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
    writeFileSync(join(stage, "post.md"), source);
    writeFileSync(join(stage, "original.md"), original);
    if (
      !readRegular(postFile).equals(original) ||
      JSON.stringify(readPosts(join(root, "src/content/posts"))) !== postsBefore
    )
      throw new Error("Posts changed during signing; rerun after reviewing");
    for (const path of [
      join(root, "public"),
      join(root, "public/reproduction"),
      parent,
      ...(images.size
        ? [
            join(root, "public/images"),
            join(root, "public/images/excel-lab"),
            join(root, "public/images/excel-lab", slug),
          ]
        : []),
    ]) {
      if (!existsSync(path)) {
        mkdirSync(path);
        createdParents.push(path);
      }
    }
    if (existsSync(pending)) {
      renameSync(pending, join(stage, "pending"));
      parkedPending = true;
    }
    if (!existsSync(destination)) {
      renameSync(join(stage, "kit"), destination);
      createdKit = true;
    }
    for (const [file, bytes] of images) {
      const target = join(root, file);
      assertDirectorySafe(root, target);
      if (existsSync(target)) {
        if (!readRegular(target).equals(bytes))
          throw new Error("Public image changed during signing");
      } else {
        renameSync(join(stage, file), target);
        createdImages.push(target);
      }
    }
    renameSync(join(stage, "post.md"), postFile);
  } catch (error) {
    try {
      for (const path of createdImages.reverse()) rmSync(path);
      if (createdKit) rmSync(destination, { recursive: true, force: true });
      if (parkedPending) renameSync(join(stage, "pending"), pending);
      for (const path of createdParents.reverse()) rmdirSync(path);
    } catch (rollbackError) {
      preserveStage = true;
      throw new Error(
        `${error.message}; rollback incomplete (${rollbackError.message}). Recovery files retained in ${stage}`
      );
    }
    throw error;
  } finally {
    if (!preserveStage) {
      try {
        rmSync(stage, { recursive: true, force: true });
      } catch {
        cleanupWarning = `Temporary cleanup incomplete; inspect ${stage}`;
      }
    }
  }
  return cleanupWarning;
}

function formatStatus(posts, root, now) {
  const count = posts.filter(
    p =>
      isPublicPost(p.data) &&
      Date.parse(p.data.pubDatetime) - 15 * 60 * 1000 < now.getTime()
  ).length;
  return (
    [
      "slug\ttitle\tstatus\tchars\tlab\tscheduled (KST)",
      ...posts.map(p => {
        const scheduled = Date.parse(p.data.pubDatetime);
        const status =
          p.data.draft === true
            ? "draft"
            : !isPublicPost(p.data)
              ? "held"
              : scheduled - 15 * 60 * 1000 >= now.getTime()
                ? "scheduled"
                : "published";
        return [
          p.slug,
          String(p.data.title).replace(/[\t\r\n]/g, " "),
          status,
          readableLength(p.body),
          existsSync(join(root, "lab/excel/cases", p.slug, "result.json"))
            ? "yes"
            : "no",
          Number.isFinite(scheduled) ? kstTimestamp(new Date(scheduled)) : "-",
        ].join("\t");
      }),
      `Readiness: ${count}/${MIN_PUBLIC_POSTS} public by date; ${Math.max(0, MIN_PUBLIC_POSTS - count)} more until ${MIN_PUBLIC_POSTS}. Future scheduled posts do not count yet; actual readiness uses the built sitemap and other checks.`,
    ].join("\n") + "\n"
  );
}

export function runSignPost(
  args,
  {
    root = fileURLToPath(new URL("..", import.meta.url)),
    now = new Date(),
  } = {}
) {
  root = resolve(root);
  const options = parseArguments(args);
  const posts = readPosts(join(root, "src/content/posts"));
  if (options["--status"]) return formatStatus(posts, root, now);
  const post = posts.find(p => p.slug === options.slug);
  if (!post) throw new Error("Post not found");
  const file = join(root, "src/content/posts", post.file);
  assertDirectorySafe(root, file);
  const original = readRegular(file);
  const kitOnly = options["--kit-only"];
  if (kitOnly) {
    if (!isPublicPost(post.data) || post.data.reproductionKit)
      throw new Error("--kit-only requires a published post without a kit");
  } else if (
    post.data.draft !== true ||
    post.data.humanReviewedBy?.trim() ||
    post.data.humanReviewedAt ||
    post.data.editorialStatus === "legacy_hold"
  ) {
    throw new Error(
      "Signing requires an unsigned draft: true post without editorial hold"
    );
  }
  const body = post.body + (options["--note"] ?? "");
  if (/소유자|TODO/i.test(body))
    throw new Error(
      "Body contains 소유자 or TODO; finish the post before signing"
    );
  privacyCheck()(body, "post body");
  const lab = join(root, "lab/excel/cases", post.slug);
  assertDirectorySafe(root, lab);
  const kit = buildSigningKit(root, post.slug);
  const changes = kitOnly
    ? { reproductionKit: kit.reference }
    : {
        draft: false,
        testingStatus: "reproduced",
        humanReviewedBy: options["--name"],
        humanReviewedAt: kstTimestamp(now),
        lastReviewed: `${kstDay(now)}T00:00:00+09:00`,
        pubDatetime: selectPublicationDate(
          posts.filter(p => p.slug !== post.slug),
          now,
          options["--date"]
        ),
        reproductionKit: kit.reference,
      };
  const source = updateFrontmatter(
    original.toString("utf8"),
    changes,
    options["--note"]
  );
  kit.checkPrivacy(source, "post output");
  const candidate = { ...post, ...parsePostSource(source) };
  const gate = evaluatePosts(
    posts.map(p => (p.slug === post.slug ? candidate : p)),
    { now }
  );
  const failures = gate.errors.filter(
    e => e.slug === post.slug || e.rule === "pace"
  );
  if (failures.length)
    throw new Error(
      failures.map(e => `[${e.rule}] ${e.slug}: ${e.message}`).join("\n")
    );
  checkDestination(root, kit, post.slug);
  const images = referencedImages(root, candidate.body, kit, post.slug);
  const output = [
    `${options["--dry-run"] ? "DRY-RUN" : kitOnly ? "KIT-ONLY" : "SIGNED"}: ${post.slug}`,
    ...Object.entries(changes).map(
      ([key, value]) => `${key}: ${JSON.stringify(value)}`
    ),
    `Kit: ${kit.files.size} files → ${kit.reference.manifestPath}; remove only this slug's pending/ after success.`,
    ...[...images.keys()].map(
      path =>
        `Image: lab/excel/cases/${post.slug}/${path.split("/").pop()} → /${path.replace(/^public\//, "")}`
    ),
    ...gate.warnings
      .filter(w => w.slug === post.slug)
      .map(w => `Warning [${w.rule}]: ${w.message}`),
    ...(Date.parse(candidate.data.pubDatetime) - 15 * 60 * 1000 >= now.getTime()
      ? [
          "예약 글은 운영 빌드에서 발행 시각 15분 전까지 제외됩니다. 정적 사이트이므로 이후 다시 빌드·배포해야 공개됩니다. (dev에서는 비초안 표시)",
        ]
      : []),
    ...(options["--note"]
      ? [`First paragraph note: ${options["--note"]}`]
      : []),
  ];
  if (!options["--dry-run"]) {
    const warning = commit(
      root,
      file,
      original,
      source,
      kit,
      post.slug,
      JSON.stringify(posts),
      images
    );
    if (warning) output.push(warning);
  }
  return output.join("\n") + "\n";
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.stdout.write(runSignPost(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`sign-post: ${error.message}\n`);
    process.exitCode = 1;
  }
}
