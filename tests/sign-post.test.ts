import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { deflateRawSync } from "node:zlib";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "./helpers/test-api.ts";
import { runSignPost, selectPublicationDate } from "../scripts/sign-post.mjs";
import { parsePostSource } from "../scripts/lib/posts.mjs";
import {
  evaluatePosts,
  MAX_POSTS_PER_7_DAYS,
} from "../scripts/check-post-quality.mjs";
import { MIN_PUBLIC_POSTS } from "../scripts/adsense-readiness.mjs";
import { loadReproductionKit } from "../src/utils/reproductionKit.ts";
import {
  buildSigningKit,
  canonicalJson,
  privacyCheck,
} from "../scripts/lib/signing-kit.mjs";

const now = new Date("2026-11-06T10:30:00+09:00");
const slug = "sample-case";
const body =
  "\r\n첫 문단을 직접 확인했습니다.  \r\n두 번째 줄도 보존합니다.\r\n\r\n" +
  ["## 입력", "## 실행", "## 비교"]
    .map(
      h =>
        h +
        "\r\n\r\n" +
        "합성 자료의 원본과 결과를 비교하고 차이를 확인합니다. ".repeat(50)
    )
    .join("\r\n\r\n") +
  "\r\n";
const sha = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
const input = '{"synthetic":true,"rows":[["invented",1]]}\n';
const args = [slug, "--name", "김실험"];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGNgYGD4//8/AAYBAv4CsjmuAAAAAElFTkSuQmCC",
  "base64"
);

test("native before/after PNGs are expected binary resources bound to deterministic hashes", () =>
  fixture((root, _post, lab) => {
    for (const name of ["before.png", "after.png", "unrelated.png"])
      writeFileSync(join(lab, name), png);
    changeResult(lab, {
      screenshots: ["before.png", "after.png"].map(file => ({
        file,
        valid: true,
        sha256: sha(png),
        pdf_text_checked: true,
      })),
    });
    const kit = buildSigningKit(root, slug);
    const manifest = JSON.parse(kit.files.get("manifest.json")!.toString());
    for (const name of ["before.png", "after.png"]) {
      const resource = manifest.resources.find(
        (r: { name: string }) => r.name === name
      );
      assert.equal(resource.path, `expected/${name}`);
      assert.equal(resource.media_type, "image/png");
      assert.equal(resource.encoding, "binary");
      assert.equal(resource.sha256, sha(png));
      assert.deepEqual(kit.files.get(resource.path), png);
    }
    assert.ok(
      !manifest.resources.some(
        (r: { name: string }) => r.name === "unrelated.png"
      )
    );
    assert.equal(
      buildSigningKit(root, slug).reference.sha256,
      kit.reference.sha256
    );
    writeFileSync(
      join(lab, "before.png"),
      Buffer.concat([png, Buffer.from("C:\\Users\\private\\account")])
    );
    const before = snapshot(root);
    assert.throws(
      () => runSignPost([...args, "--dry-run"], { root, now }),
      /PNG|hash|leak/i
    );
    assert.deepEqual(snapshot(root), before);
  }));

test("PNG publication refuses unverified captures, identity metadata and oversized assets", () => {
  const metadata = Buffer.from("Author\0C:\\Users\\private\\account");
  const chunk = Buffer.alloc(metadata.length + 12);
  chunk.writeUInt32BE(metadata.length);
  chunk.write("tEXt", 4);
  metadata.copy(chunk, 8);
  for (const bytes of [
    png,
    Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]),
    Buffer.alloc(300_000),
  ])
    fixture((root, _post, lab) => {
      writeFileSync(join(lab, "before.png"), bytes);
      changeResult(lab, {
        screenshots: [
          {
            file: "before.png",
            valid: bytes !== png,
            pdf_text_checked: true,
            sha256: sha(bytes),
          },
        ],
      });
      const before = snapshot(root);
      assert.throws(
        () => runSignPost([...args, "--dry-run"], { root, now }),
        /PNG/i
      );
      assert.deepEqual(snapshot(root), before);
    });
});

test("validated PNG pixel bytes are binary, and changing the image changes the kit hash", () =>
  fixture((root, _post, lab) => {
    // Valid RGB pixels with an uncompressed IDAT containing the bytes C:\, not rendered text.
    const pixels = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABQAAAABCAIAAABR8BlyAAAASElEQVR4AQE9AML/AUM6XBI5CR0A9wEGEgHv9wAB/ugHBhz1A7X9DUcD+rzMvwMDAwMDAwMMAiMSOQkdAPcBBhIB7/cAAf7oBygpEjEucXUgAAAAAElFTkSuQmCC",
      "base64"
    );
    const before = buildSigningKit(root, slug).reference.sha256;
    writeFileSync(join(lab, "before.png"), pixels);
    changeResult(lab, {
      screenshots: [
        {
          file: "before.png",
          valid: true,
          pdf_text_checked: true,
          sha256: sha(pixels),
        },
      ],
    });
    const kit = buildSigningKit(root, slug);
    assert.deepEqual(kit.files.get("expected/before.png"), pixels);
    assert.notEqual(kit.reference.sha256, before);
    assert.equal(
      buildSigningKit(root, slug).reference.sha256,
      kit.reference.sha256
    );
  }));

function fixture(fn: (root: string, post: string, lab: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "xici-sign-test-"));
  const post = join(root, "src/content/posts", slug + ".md");
  const lab = join(root, "lab/excel/cases", slug);
  mkdirSync(join(root, "src/content/posts"), { recursive: true });
  mkdirSync(lab, { recursive: true });
  writeFileSync(
    post,
    '\uFEFF---\r\n# preserve this comment\r\ntitle: "합성 자료 비교"\r\ndraft: true\r\npubDatetime: 2026-11-01T09:00:00+09:00\r\ntestingStatus: not_tested\r\nsources:\r\n  - "https://learn.microsoft.com/a"\r\n  - "https://support.microsoft.com/b"\r\ntags: ["excel"]\r\ncustom: \'untouched\'\r\n---\r\n' +
      body
  );
  writeFileSync(join(lab, "input.json"), input);
  writeFileSync(
    join(lab, "query.m"),
    'let Source = #table({"Key"}, {{"invented"}}) in Source\n'
  );
  writeFileSync(join(lab, "fixed.m"), "let X = 1 in X\n");
  writeFileSync(
    join(lab, "result.json"),
    JSON.stringify({
      slug,
      status: "pass",
      run_at: "2026-11-05T12:00:00Z",
      excel_version: "16.0",
      excel_build: "12345",
      ui_language: { culture: "ko-KR" },
      input_sha256: { "input.json": sha(input) },
      steps: [
        {
          name: "readback",
          observed: { rows: [["invented", 1]] },
          formula_or_m: "Value2",
        },
      ],
      assertions: [{ name: "rows", passed: true }],
      not_verified: ["Other Excel builds", "Ribbon clicks"],
      environment: { synthetic: true, printer: "private printer" },
      cleanup: { owned_pid: 987654 },
      screenshots: [{ path: "C:\\Users\\private\\image.png" }],
    })
  );
  writeFileSync(
    join(lab, "owned-process.json"),
    '{"pid":987654,"start_time":"2026-11-05T12:00:01Z"}'
  );
  const pending = join(root, "public/reproduction", slug, "pending");
  mkdirSync(pending, { recursive: true });
  writeFileSync(join(pending, "manifest.json"), '{"result":"pending"}');
  try {
    fn(root, post, lab);
  } finally {
    assert.ok(
      resolve(root).startsWith(resolve(tmpdir()) + "/") ||
        resolve(root).startsWith(resolve(tmpdir()) + "\\")
    );
    rmSync(root, { recursive: true, force: true });
  }
}

function snapshot(root: string): Record<string, string> {
  const files: Record<string, string> = {};
  function walk(dir: string, prefix = "") {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const name = prefix + e.name;
      if (e.isDirectory()) {
        files[name + "/"] = "directory";
        walk(join(dir, e.name), name + "/");
      } else files[name] = readFileSync(join(dir, e.name)).toString("base64");
    }
  }
  walk(root);
  return files;
}

function changeResult(lab: string, update: Record<string, unknown>) {
  const file = join(lab, "result.json");
  writeFileSync(
    file,
    JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), ...update })
  );
}

test("refuses absent, empty, placeholder and machine signers without writing", () => {
  for (const name of [
    undefined,
    "",
    " ",
    "TODO",
    "owner",
    "소유자",
    "미정",
    "Claude",
    "gpt",
    "my agent",
    "AI",
    "Gemini",
    "ChatGPT",
    "Codex",
    "Opus 5.5",
    "클로드",
    "Sonnet",
    "Haiku",
    "Fable",
    "제미나이",
    "Grok",
    "Copilot",
    "Llama",
    "bot",
  ])
    fixture(root => {
      const before = snapshot(root);
      assert.throws(
        () =>
          runSignPost(name === undefined ? [slug] : [slug, "--name", name], {
            root,
            now,
          }),
        /name|signer/i
      );
      assert.deepEqual(snapshot(root), before);
    });
});

test("refuses published, signed, held or unfinished drafts and body leaks", () => {
  for (const edit of [
    (s: string) => s.replace("draft: true", "draft: false"),
    (s: string) =>
      s.replace("draft: true", 'draft: true\r\nhumanReviewedBy: "김기존"'),
    (s: string) =>
      s.replace("draft: true", "draft: true\r\nhumanReviewedAt: 2026-11-01"),
    (s: string) =>
      s.replace("draft: true", "draft: true\r\neditorialStatus: legacy_hold"),
    ...[
      "소유자",
      "TODO",
      "C:\\Users\\someone",
      "Desktop\\Python",
      "C:\\Users\\private",
    ].map(leak => (s: string) => s + leak),
  ])
    fixture((root, post) => {
      writeFileSync(post, edit(readFileSync(post, "utf8")));
      const before = snapshot(root);
      assert.throws(() => runSignPost(args, { root, now }));
      assert.deepEqual(snapshot(root), before);
    });
});

test("quality-gate failures and unsuccessful or stale evidence are all or nothing", () => {
  fixture((root, post) => {
    writeFileSync(post, readFileSync(post, "utf8").replace(body, "short"));
    const before = snapshot(root);
    assert.throws(() => runSignPost(args, { root, now }), /body-length/);
    assert.deepEqual(snapshot(root), before);
  });
  for (const update of [
    { status: "fail" },
    { slug: "another-case" },
    { run_at: "invalid" },
    { assertions: [{ passed: false }] },
    { input_sha256: { "input.json": "0".repeat(64) } },
  ])
    fixture((root, _post, lab) => {
      changeResult(lab, update);
      const before = snapshot(root);
      assert.throws(() => runSignPost(args, { root, now }));
      assert.deepEqual(snapshot(root), before);
    });
});

test("fails closed on paths and owned-process values in any public payload", () => {
  for (const leak of [
    "C:\\Users\\private",
    "/home/alice/work",
    "C:\\Users\\someone",
    "Desktop\\Python",
    "987654",
    "2026-11-05T12:00:01Z",
  ])
    fixture((root, _post, lab) => {
      changeResult(lab, { observations_ko: [leak] });
      const before = snapshot(root);
      assert.throws(
        () => runSignPost(args, { root, now }),
        /private|local|leak/i
      );
      assert.deepEqual(snapshot(root), before);
    });
  fixture((root, _post, lab) => {
    writeFileSync(
      join(lab, "fixed.m"),
      'File.Contents("C:\\private\\file.csv")'
    );
    const before = snapshot(root);
    assert.throws(
      () => runSignPost(args, { root, now }),
      /private|local|leak/i
    );
    assert.deepEqual(snapshot(root), before);
  });
});

test("signs with KST metadata, preserves unrelated front matter and every body byte, and passes existing kit validation", () =>
  fixture((root, post, lab) => {
    writeFileSync(join(lab, "evidence.xlsx"), "must never publish");
    writeFileSync(join(lab, "stdout.log"), "must never publish");
    mkdirSync(join(lab, "runs"));
    writeFileSync(join(lab, "runs/private.txt"), "private");
    const out = runSignPost(args, { root, now });
    const raw = readFileSync(post, "utf8");
    const p = parsePostSource(raw);
    assert.equal(p.body, body);
    assert.ok(raw.startsWith("\uFEFF"));
    assert.ok(raw.includes("# preserve this comment\r\n"));
    assert.ok(raw.includes("custom: 'untouched'\r\n"));
    assert.equal(p.data.draft, false);
    assert.equal(p.data.testingStatus, "reproduced");
    assert.equal(p.data.humanReviewedBy, "김실험");
    assert.equal(p.data.humanReviewedAt, "2026-11-06T10:30:00+09:00");
    assert.equal(p.data.lastReviewed, "2026-11-06T00:00:00+09:00");
    assert.equal(p.data.pubDatetime, "2026-11-06T10:30:00+09:00");
    const m = loadReproductionKit(p.data.reproductionKit, slug, root);
    assert.equal(m.evidence.result, "pass");
    assert.equal(m.evidence.run_at, "2026-11-05T12:00:00Z");
    assert.ok(m.limitations.includes("Other Excel builds"));
    assert.ok(m.limitations.includes("Ribbon clicks"));
    assert.ok(m.resources.some(r => r.name === "fixed.m"));
    assert.ok(m.procedure.length >= 3);
    const result = m.resources.find(r => r.path === "expected/result.json")!;
    assert.equal(m.evidence.record_sha256, result.sha256);
    const publicFiles = Object.keys(snapshot(join(root, "public")));
    assert.ok(
      !publicFiles.some(f =>
        /pending|runs|owned-process|evidence.xlsx|stdout/.test(f)
      )
    );
    assert.match(out, /sample-case/);
    assert.deepEqual(
      evaluatePosts([{ file: slug + ".md", slug, ...p }], { now }).errors,
      []
    );
  }));

test("same inputs produce a deterministic kit hash regardless of signing name or result key order", () => {
  let first: string;
  fixture((root, post) => {
    runSignPost(args, { root, now });
    first = parsePostSource(readFileSync(post, "utf8")).data.reproductionKit
      .sha256;
  });
  fixture((root, post, lab) => {
    const file = join(lab, "result.json");
    const r = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(
      file,
      JSON.stringify(Object.fromEntries(Object.entries(r).reverse()), null, 4)
    );
    runSignPost([slug, "--name", "다른필명"], { root, now });
    assert.equal(
      parsePostSource(readFileSync(post, "utf8")).data.reproductionKit.sha256,
      first
    );
  });
});

test("note inserts exactly one paragraph after the first prose paragraph, leaving every existing byte", () =>
  fixture((root, post) => {
    const note = "제가 직접 합성 결과를 확인했습니다.";
    runSignPost([...args, "--note", note], { root, now });
    const actual = parsePostSource(readFileSync(post, "utf8")).body;
    const index = body.indexOf("\r\n\r\n", body.indexOf("첫 문단"));
    assert.equal(
      actual,
      body.slice(0, index) + "\r\n\r\n" + note + body.slice(index)
    );
  }));

test("dry run validates and describes changes without even creating temporary files", () =>
  fixture(root => {
    const before = snapshot(root);
    const output = runSignPost([...args, "--date", "2026-11-15", "--dry-run"], {
      root,
      now,
    });
    assert.match(output, /dry-run/i);
    assert.match(output, /2026-11-15T09:00:00\+09:00/);
    assert.match(output, /15분|15 minutes/);
    assert.match(output, /빌드|build/i);
    assert.deepEqual(snapshot(root), before);
  }));

test("rolling pace is half-open [start, start + 7 days), including later scheduled posts", () => {
  const posts = Array.from({ length: MAX_POSTS_PER_7_DAYS }, (_, i) => ({
    slug: `p-${i}`,
    data: { draft: false, pubDatetime: "2026-11-01T09:00:00+09:00" },
  }));
  assert.throws(() => selectPublicationDate(posts, now, "2026-11-07"), /pace/);
  assert.equal(
    selectPublicationDate(posts, now, "2026-11-08"),
    "2026-11-08T09:00:00+09:00"
  );
  assert.equal(selectPublicationDate(posts, now), "2026-11-08T10:30:00+09:00");
  const future = posts.map(p => ({
    ...p,
    data: { ...p.data, pubDatetime: "2026-11-10T09:00:00+09:00" },
  }));
  assert.throws(() => selectPublicationDate(future, now, "2026-11-06"), /pace/);
  assert.equal(selectPublicationDate(future, now), "2026-11-17T10:30:00+09:00");
});

test("kit-only adds only reproductionKit to a published post, keeping unsigned fields untouched", () =>
  fixture((root, post) => {
    const before = readFileSync(post, "utf8")
      .replace(
        "draft: true",
        "draft: false\r\nlastReviewed: 2026-09-20T00:00:00+09:00"
      )
      .replace("2026-11-01T09", "2026-09-20T09")
      .replace(
        "testingStatus: not_tested",
        "testingStatus: official_source_only"
      );
    writeFileSync(post, before);
    runSignPost([slug, "--kit-only"], { root, now });
    const after = readFileSync(post, "utf8");
    const p = parsePostSource(after);
    assert.equal(
      after.replace(
        /reproductionKit:\r\n  manifestPath: [^\r]+\r\n  sha256: [^\r]+\r\n/,
        ""
      ),
      before
    );
    assert.equal(p.data.humanReviewedBy, undefined);
    assert.equal(p.data.testingStatus, "official_source_only");
    loadReproductionKit(p.data.reproductionKit, slug, root);
    assert.throws(
      () => runSignPost([slug, "--kit-only"], { root, now }),
      /kit/i
    );
  }));

test("status lists drafts, published and scheduled posts with evidence, length and reused threshold", () =>
  fixture((root, post) => {
    const before = snapshot(root);
    const output = runSignPost(["--status"], { root, now });
    assert.match(output, /slug.*title.*status.*chars.*lab.*scheduled/i);
    assert.match(output, /sample-case.*합성 자료 비교.*draft.*yes/);
    assert.match(
      output,
      new RegExp(`${MIN_PUBLIC_POSTS}.*${MIN_PUBLIC_POSTS}`)
    );
    assert.deepEqual(snapshot(root), before);
    writeFileSync(
      post,
      readFileSync(post, "utf8")
        .replace("draft: true", "draft: false")
        .replace("2026-11-01T09", "2026-11-20T09")
    );
    assert.match(runSignPost(["--status"], { root, now }), /scheduled/);
  }));

test("invalid CLI combinations, slug traversal and invalid dates refuse without writes", () => {
  for (const a of [
    ["../sample", "--name", "김실험"],
    [...args, "--wat"],
    [...args, "--date", "2026-02-30"],
    [...args, "--date", "2026-11-01"],
    [...args, "--kit-only"],
    ["--status", slug],
    [...args, "--note", "line\nbreak"],
    [...args, "--name", "again"],
  ])
    fixture(root => {
      const before = snapshot(root);
      assert.throws(() => runSignPost(a, { root, now }));
      assert.deepEqual(snapshot(root), before);
    });
});

// Minimal compressed ZIP member, sufficient to exercise XLSX privacy inspection.
function workbook(payload: string) {
  const name = Buffer.from("xl/workbook.xml");
  const xml = Buffer.from(payload);
  const compressed = deflateRawSync(xml);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(xml.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(xml.length, 24);
  central.writeUInt16LE(name.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(local.length + name.length + compressed.length, 16);
  return Buffer.concat([local, name, compressed, central, name, end]);
}

test("inspects compressed XLSX metadata and publishes only the synthetic input workbook", () => {
  for (const payload of [
    '<workbook creator="synthetic"/>',
    '<workbook path="C:\\Users\\private\\work"/>',
    '<workbook creator="C:\\Users\\someone"/>',
  ])
    fixture((root, post, lab) => {
      const bytes = workbook(payload);
      writeFileSync(join(lab, "input.xlsx"), bytes);
      writeFileSync(join(lab, "other.xlsx"), "excluded binary");
      changeResult(lab, {
        input_sha256: { "input.json": sha(input), "input.xlsx": sha(bytes) },
      });
      const before = snapshot(root);
      if (/synthetic/.test(payload)) {
        runSignPost(args, { root, now });
        const p = parsePostSource(readFileSync(post, "utf8"));
        const manifest = loadReproductionKit(
          p.data.reproductionKit,
          slug,
          root
        );
        assert.ok(manifest.resources.some(r => r.name === "input.xlsx"));
        assert.ok(!manifest.resources.some(r => r.name === "other.xlsx"));
      } else {
        assert.throws(() => runSignPost(args, { root, now }), /leak/i);
        assert.deepEqual(snapshot(root), before);
      }
    });
});

test("note skips a complete fenced block and heading before the first paragraph", () =>
  fixture((root, post) => {
    const prefix = "\r\n## 소개\r\n\r\n```text\r\ncode\r\n```\r\n\r\n";
    writeFileSync(
      post,
      readFileSync(post, "utf8").replace(body, prefix + body)
    );
    runSignPost([...args, "--note", "직접 비교했습니다."], { root, now });
    const actual = parsePostSource(readFileSync(post, "utf8")).body;
    assert.equal(
      actual.replace("\r\n\r\n직접 비교했습니다.", ""),
      prefix + body
    );
    assert.ok(actual.indexOf("직접 비교했습니다.") < actual.indexOf("## 입력"));
  }));

test("refuses local identity in unchanged front matter or signer", () =>
  fixture((root, post) => {
    writeFileSync(
      post,
      readFileSync(post, "utf8").replace(
        "custom: 'untouched'",
        "custom: 'C:\\Users\\private\\data'"
      )
    );
    const before = snapshot(root);
    assert.throws(() => runSignPost(args, { root, now }), /leak/i);
    assert.deepEqual(snapshot(root), before);
  }));

test("ordinary HTTPS links are not local paths", () =>
  fixture((root, post) => {
    writeFileSync(
      post,
      readFileSync(post, "utf8") +
        "\r\n[공식 문서](https://learn.microsoft.com/power-query)\r\n"
    );
    assert.doesNotThrow(() =>
      runSignPost([...args, "--dry-run"], { root, now })
    );
  }));

test("failed final post move restores pending and removes only the staged kit", () =>
  fixture((root, _post, _lab) => {
    const before = snapshot(root);
    const rename = fs.renameSync;
    fs.renameSync = ((from, to) => {
      if (String(from).endsWith("post.md"))
        throw new Error("simulated final move failure");
      return rename(from, to);
    }) as typeof fs.renameSync;
    syncBuiltinESMExports();
    try {
      assert.throws(
        () => runSignPost(args, { root, now }),
        /simulated final move failure/
      );
      assert.deepEqual(snapshot(root), before);
    } finally {
      fs.renameSync = rename;
      syncBuiltinESMExports();
    }
  }));

test("LF posts without a BOM preserve body bytes and an existing kit toolPath", () =>
  fixture((root, post) => {
    const raw = readFileSync(post, "utf8")
      .replace(/^\uFEFF/, "")
      .replaceAll("\r\n", "\n")
      .replace(
        "custom: 'untouched'",
        'custom: \'untouched\'\nreproductionKit:\n  manifestPath: "/reproduction/sample-case/pending/manifest.json"\n  sha256: "pending"\n  toolPath: "/tools/csv-preview/"'
      );
    writeFileSync(post, raw);
    runSignPost(args, { root, now });
    const result = readFileSync(post, "utf8");
    assert.ok(!result.includes("\r"));
    assert.equal(parsePostSource(result).body, body.replaceAll("\r\n", "\n"));
    assert.equal(
      parsePostSource(result).data.reproductionKit.toolPath,
      "/tools/csv-preview/"
    );
  }));

test("exactly seven days minus one millisecond remains inside the pace window", () => {
  const posts = Array.from({ length: MAX_POSTS_PER_7_DAYS }, (_, i) => ({
    slug: `p-${i}`,
    data: { draft: false, pubDatetime: "2026-11-01T09:00:00.001+09:00" },
  }));
  assert.throws(() => selectPublicationDate(posts, now, "2026-11-08"), /pace/);
  assert.equal(selectPublicationDate(posts, now), "2026-11-08T10:30:00+09:00");
});

test("default publication never precedes review, before and after 09:00 KST", () => {
  for (const [time, expected] of [
    ["2026-11-07T08:00:00+09:00", "2026-11-07T09:00:00+09:00"],
    ["2026-11-07T14:20:30+09:00", "2026-11-07T14:20:30+09:00"],
    ["2026-11-07T00:00:00+09:00", "2026-11-07T09:00:00+09:00"],
  ])
    assert.equal(selectPublicationDate([], new Date(time)), expected);
});

test("ordinary human names do not match machine signer words", () => {
  for (const name of [
    "Abbott",
    "Agenta",
    "김아이",
    "Claudette",
    "Hailey",
    "김민수",
  ])
    fixture(root =>
      assert.doesNotThrow(() =>
        runSignPost([slug, "--name", name, "--dry-run"], { root, now })
      )
    );
});

test("privacy permits only a flat sample file and rejects escaped traversal and drive-less Users", () => {
  const check = privacyCheck();
  const good = String.raw`C:\샘플\source.csv`;
  for (const value of [good, canonicalJson({ path: good })])
    assert.doesNotThrow(() => check(value, "sample"));
  for (const path of [
    String.raw`C:\샘플\..\Users\x\y`,
    String.raw`\Users\x`,
    String.raw`C:\샘플\sub\file.csv`,
    String.raw`C:\샘플\file name\secret.csv`,
    String.raw`C:\샘플\..`,
    String.raw`C:\샘플x\file.csv`,
  ])
    for (const value of [path, canonicalJson({ path })])
      assert.throws(() => check(value, "unsafe"), /Private/);
});

test("privacy rejects the runtime computer name without exposing it", () => {
  const previous = process.env.COMPUTERNAME;
  process.env.COMPUTERNAME = "synthetic-machine-token";
  try {
    assert.throws(
      () => privacyCheck()("synthetic-machine-token", "payload"),
      /Private/
    );
  } finally {
    if (previous === undefined) delete process.env.COMPUTERNAME;
    else process.env.COMPUTERNAME = previous;
  }
});

function referenceImages(post: string, lab: string) {
  writeFileSync(
    post,
    readFileSync(post, "utf8") +
      `\r\n![전](/images/excel-lab/${slug}/before.png)\r\n![후](/images/excel-lab/${slug}/after.png)\r\n`
  );
  for (const name of ["before.png", "after.png"])
    writeFileSync(join(lab, name), png);
  changeResult(lab, {
    screenshots: ["before.png", "after.png"].map(file => ({
      file,
      valid: true,
      pdf_text_checked: true,
      sha256: sha(png),
    })),
  });
}

test("referenced images are listed in dry-run and published together for signing and kit-only", () => {
  for (const kitOnly of [false, true])
    fixture((root, post, lab) => {
      referenceImages(post, lab);
      if (kitOnly)
        writeFileSync(
          post,
          readFileSync(post, "utf8")
            .replace(
              "draft: true",
              "draft: false\r\nlastReviewed: 2026-09-20T00:00:00+09:00"
            )
            .replace("2026-11-01T09", "2026-09-20T09")
            .replace(
              "testingStatus: not_tested",
              "testingStatus: official_source_only"
            )
        );
      const flags = kitOnly ? [slug, "--kit-only"] : args;
      const before = snapshot(root);
      const preview = runSignPost([...flags, "--dry-run"], { root, now });
      assert.deepEqual(snapshot(root), before);
      for (const name of ["before.png", "after.png"])
        assert.ok(preview.includes(`/images/excel-lab/${slug}/${name}`));
      runSignPost(flags, { root, now });
      for (const name of ["before.png", "after.png"])
        assert.deepEqual(
          readFileSync(join(root, "public/images/excel-lab", slug, name)),
          png
        );
    });
});

test("missing lab image or conflicting public image refuses before any write", () => {
  for (const conflict of [false, true])
    fixture((root, post, lab) => {
      referenceImages(post, lab);
      if (conflict) {
        const dest = join(root, "public/images/excel-lab", slug);
        mkdirSync(dest, { recursive: true });
        writeFileSync(join(dest, "before.png"), "conflict");
      } else rmSync(join(lab, "after.png"));
      const before = snapshot(root);
      assert.throws(
        () => runSignPost([...args, "--dry-run"], { root, now }),
        /image|PNG/i
      );
      assert.deepEqual(snapshot(root), before);
    });
});

test("image publication rolls back with the kit when the final post move fails", () =>
  fixture((root, post, lab) => {
    referenceImages(post, lab);
    const before = snapshot(root),
      rename = fs.renameSync;
    fs.renameSync = ((from, to) => {
      if (String(from).endsWith("post.md"))
        throw new Error("simulated image transaction failure");
      return rename(from, to);
    }) as typeof fs.renameSync;
    syncBuiltinESMExports();
    try {
      assert.throws(
        () => runSignPost(args, { root, now }),
        /simulated image transaction failure/
      );
      assert.deepEqual(snapshot(root), before);
    } finally {
      fs.renameSync = rename;
      syncBuiltinESMExports();
    }
  }));

test("kit-only preserves an existing human signature verbatim", () =>
  fixture((root, post) => {
    const raw = readFileSync(post, "utf8")
      .replace(
        "draft: true",
        "draft: false\r\nhumanReviewedBy: '김검토'\r\nhumanReviewedAt: 2026-11-01T10:00:00+09:00\r\nlastReviewed: 2026-11-01T00:00:00+09:00"
      )
      .replace(
        "testingStatus: not_tested",
        "testingStatus: official_source_only"
      );
    writeFileSync(post, raw);
    runSignPost([slug, "--kit-only"], { root, now });
    const after = readFileSync(post, "utf8");
    assert.equal(
      after.replace(
        /reproductionKit:\r\n  manifestPath: [^\r]+\r\n  sha256: [^\r]+\r\n/,
        ""
      ),
      raw
    );
  }));

test("a conflicting existing kit fails even in dry-run and preserves sibling kits", () =>
  fixture(root => {
    const output = runSignPost([...args, "--dry-run"], { root, now });
    const hash = /"sha256":"([a-f0-9]{64})"/.exec(output)![1];
    const kit = join(root, "public/reproduction", slug, hash);
    mkdirSync(kit);
    writeFileSync(join(kit, "manifest.json"), "conflict");
    const sibling = join(root, "public/reproduction", slug, "a".repeat(64));
    mkdirSync(sibling);
    writeFileSync(join(sibling, "manifest.json"), "another kit");
    const before = snapshot(root);
    for (const flags of [args, [...args, "--dry-run"]]) {
      assert.throws(
        () => runSignPost(flags, { root, now }),
        /refusing to overwrite/i
      );
      assert.deepEqual(snapshot(root), before);
    }
  }));
