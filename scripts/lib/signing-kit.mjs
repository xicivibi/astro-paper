import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

// Sort mapping keys, retaining array order and observed values.
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function readRegular(file) {
  if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) {
    throw new Error("Refusing non-regular file or symbolic link");
  }
  return readFileSync(file);
}

const LOCAL_PATH =
  /(?<![a-z0-9])[a-z]:[\\/]|\\\\[^\s\\]+\\|\\+Users\\|\/(?:users|home|tmp|private|mnt|var|opt|volumes)\/|Desktop[\\/]+Python/i;

function scalarValues(value) {
  if (value && typeof value === "object")
    return Object.values(value).flatMap(scalarValues);
  return typeof value === "string" || typeof value === "number"
    ? [String(value)]
    : [];
}

export function privacyCheck(owned = {}) {
  const names = [
    process.env.USERNAME,
    process.env.USER,
    process.env.COMPUTERNAME,
  ].filter(Boolean);
  const forbidden = [...scalarValues(owned), ...names].map(x =>
    x.toLowerCase()
  );
  return (value, label) => {
    const text = Buffer.isBuffer(value)
      ? value.toString("utf8")
      : String(value);
    const lower = text.toLowerCase();
    const paths = text.replace(/[A-Z]:\\{1,2}샘플\\{1,2}[^\r\n"'<>`]+/g, path => {
      const flat = path.replace(/\\\\/g, "\\");
      return /^[A-Z]:\\샘플\\[^\\/:]+$/.test(flat) && !flat.includes("..")
        ? ""
        : path;
    });
    if (
      LOCAL_PATH.test(paths) ||
      forbidden.some(token => lower.includes(token))
    ) {
      throw new Error(
        `Private/local path or process value leak in ${label}; sanitize the source before signing`
      );
    }
  };
}

// Inspect ZIP members, not just compressed XLSX bytes (including creator metadata).
function checkWorkbook(bytes, check) {
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    bytes.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  if (end < 0 || end < bytes.length - 65557)
    throw new Error("Invalid synthetic input.xlsx ZIP");
  const entries = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  let total = 0;
  if (!entries || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    throw new Error("Unsupported input.xlsx ZIP");
  for (let i = 0; i < entries; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Invalid input.xlsx directory");
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const size = bytes.readUInt32LE(offset + 20);
    const expanded = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const local = bytes.readUInt32LE(offset + 42);
    total += expanded;
    if (flags & 1 || ![0, 8].includes(method) || total > 64 * 1024 * 1024)
      throw new Error("Unsafe input.xlsx ZIP");
    const member = bytes.subarray(offset + 46, offset + 46 + nameLength);
    check(member, "input.xlsx member name");
    if (bytes.readUInt32LE(local) !== 0x04034b50)
      throw new Error("Invalid input.xlsx member");
    const start =
      local +
      30 +
      bytes.readUInt16LE(local + 26) +
      bytes.readUInt16LE(local + 28);
    const compressed = bytes.subarray(start, start + size);
    const payload =
      method === 8
        ? inflateRawSync(compressed, { maxOutputLength: 64 * 1024 * 1024 })
        : compressed;
    if (payload.length !== expanded || start + size > bytes.length)
      throw new Error("Invalid input.xlsx size");
    check(payload, `input.xlsx member ${member.toString("utf8")}`);
    // The Office account name is the real name of the author, which no fixed pattern can catch.
    if (
      /<dc:creator>[^<]|<cp:lastModifiedBy>[^<]/.test(payload.toString("utf8"))
    )
      throw new Error(
        "input.xlsx names its author; run lab/excel/sanitize_public.py"
      );
    check(
      payload.toString("utf16le"),
      `input.xlsx UTF-16 member ${member.toString("utf8")}`
    );
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

function checkPng(bytes) {
  if (
    bytes.length >= 300_000 ||
    !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  )
    throw new Error("Invalid or oversized PNG");
  let offset = 8;
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (
      offset + 12 + size > bytes.length ||
      ![
        "IHDR",
        "PLTE",
        "IDAT",
        "IEND",
        "tRNS",
        "sRGB",
        "gAMA",
        "cHRM",
        "pHYs",
      ].includes(type)
    )
      throw new Error("Unsafe PNG metadata or chunk");
    offset += 12 + size;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length) throw new Error("Invalid PNG end");
  // Compressed pixels are binary; all textual metadata is forbidden above.
}

export function buildSigningKit(root, slug) {
  const directory = join(root, "lab/excel/cases", slug);
  const read = name => readRegular(join(directory, name));
  const parse = bytes =>
    JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  const result = parse(read("result.json"));
  const input = parse(read("input.json"));
  const ownedFile = join(directory, "owned-process.json");
  const check = privacyCheck(
    existsSync(ownedFile) ? parse(read("owned-process.json")) : {}
  );
  if (
    result.slug !== slug ||
    result.status !== "pass" ||
    !Number.isFinite(Date.parse(result.run_at)) ||
    !result.steps?.length ||
    !result.assertions?.length ||
    result.assertions.some(a => a.passed !== true) ||
    !Array.isArray(result.not_verified) ||
    input.synthetic !== true ||
    result.environment?.synthetic !== true ||
    !result.excel_version ||
    !result.ui_language?.culture
  ) {
    throw new Error(
      "Lab evidence must be a passing, observed synthetic case with run_at, scope and assertions"
    );
  }
  // Local execution metadata is deliberately outside the public evidence record.
  const {
    cleanup: _cleanup,
    retired_instances: _retired,
    screenshots: _screenshots,
    environment,
    ...observed
  } = result;
  const { printer: _printer, ...publicEnvironment } = environment;
  const sanitized = { ...observed, environment: publicEnvironment };
  const files = new Map();
  const resources = [];
  const names = readdirSync(directory)
    .filter(
      name =>
        name === "input.json" ||
        name === "input.xlsx" ||
        name === "source.csv" ||
        /\.m$/.test(name)
    )
    .sort();
  if (!result.input_sha256?.["input.json"])
    throw new Error("Missing recorded input hashes");
  for (const name of names) {
    if (!/^[a-z0-9][a-z0-9._-]{0,80}$/.test(name))
      throw new Error("Unsafe kit file name");
    const bytes = read(name);
    if (name.endsWith(".xlsx")) checkWorkbook(bytes, check);
    else {
      check(bytes, name);
      check(bytes.toString("utf16le"), name);
    }
    if (!name.endsWith(".m") && result.input_sha256[name] !== sha256(bytes))
      throw new Error(`Stale or missing input hash: ${name}`);
    files.set(`input/${name}`, bytes);
  }
  for (const name of Object.keys(result.input_sha256)) {
    // The locale case also hashes the published Markdown; do not publish it as an input.
    if (name.endsWith(".md")) continue;
    if (!files.has(`input/${name}`))
      throw new Error(
        "Recorded input is missing or not an allowed synthetic input"
      );
  }
  const record = Buffer.from(canonicalJson(sanitized));
  files.set("expected/result.json", record);
  for (const name of ["before.png", "after.png"]) {
    if (!existsSync(join(directory, name))) continue;
    const bytes = read(name);
    checkPng(bytes);
    const evidence = result.screenshots?.find(image => image.file === name);
    if (
      !evidence?.valid ||
      evidence.pdf_text_checked !== true ||
      evidence.sha256 !== sha256(bytes)
    )
      throw new Error(`Missing or stale validated PNG hash: ${name}`);
    files.set(`expected/${name}`, bytes);
  }
  for (const [path, bytes] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // Binary payloads are checked structurally; PNG pixels were privacy-checked in the native PDF.
    if (!/\.(xlsx|png)$/.test(path)) check(bytes, path);
    const name = path.split("/")[1];
    resources.push({
      bytes: bytes.length,
      encoding: /\.(xlsx|png)$/.test(name)
        ? "binary"
        : bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))
          ? "utf-8-sig"
          : "utf-8",
      media_type: name.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : name.endsWith(".png")
          ? "image/png"
          : name.endsWith(".json")
            ? "application/json"
            : name.endsWith(".csv")
              ? "text/csv"
              : "text/plain",
      name,
      path,
      role: path.startsWith("input/") ? "input" : "expected",
      sha256: sha256(bytes),
    });
  }
  const digestGroup = predicate =>
    sha256(
      canonicalJson(
        resources
          .filter(predicate)
          .map(r => ({ path: r.path, sha256: r.sha256 }))
      )
    );
  const manifest = {
    schema: "xici.reproduction-kit/v1",
    article_id: slug,
    case_id: slug,
    profile: "data-package",
    scope: {
      locale: result.ui_language.culture,
      os_family: "Windows",
      product: "Microsoft Excel",
      product_version: `${result.excel_version}${result.excel_build ? ` build ${result.excel_build}` : ""}`,
    },
    evidence: {
      result: result.status,
      run_at: result.run_at,
      record_sha256: sha256(record),
      input_sha256: digestGroup(
        r => r.role === "input" && !r.name.endsWith(".m")
      ),
      artifact_sha256: digestGroup(r => r.name.endsWith(".m")),
    },
    procedure: [
      {
        id: "step-1",
        instruction:
          "input/의 합성 입력을 기록된 Excel 환경에서 엽니다. M 파일의 {{...}} 경로는 다운로드한 합성 파일 위치로 지정합니다.",
      },
      {
        id: "step-2",
        instruction:
          "expected/result.json의 steps에 기록된 M 또는 수식과 관측 순서대로 실행합니다. 제공된 .m 파일은 해당 실험의 쿼리 변형입니다.",
      },
      {
        id: "step-3",
        instruction:
          "실제 출력과 expected/result.json의 관측값·assertions를 비교하고 not_verified의 미확인 범위를 확인합니다.",
      },
    ],
    resources,
    limitations: [
      ...result.not_verified,
      "공개 기록에서 로컬 프로세스·프린터·화면 파일 메타데이터를 제외했습니다. 합성 입력과 기록된 환경의 관측이며 다른 환경이나 사람의 검토를 대신하지 않습니다.",
    ],
  };
  const manifestBytes = Buffer.from(canonicalJson(manifest));
  check(manifestBytes, "manifest.json");
  files.set("manifest.json", manifestBytes);
  const hash = sha256(manifestBytes);
  return {
    files,
    checkPrivacy: check,
    reference: {
      manifestPath: `/reproduction/${slug}/${hash}/manifest.json`,
      sha256: hash,
    },
  };
}
