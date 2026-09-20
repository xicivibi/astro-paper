import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";

export type ReproductionKitReference = {
  manifestPath: string;
  sha256: string;
  toolPath?: string;
};

type Resource = {
  bytes: number;
  encoding: string;
  media_type: string;
  name: string;
  path: string;
  role: "input" | "expected";
  sha256: string;
  href: string;
};

export type PublicReproductionManifest = {
  article_id: string;
  case_id: string;
  schema: "xici.reproduction-kit/v1";
  scope: {
    locale: string;
    os_family: string;
    product: string;
    product_version: string;
  };
  evidence: {
    artifact_sha256: string;
    input_sha256: string;
    record_sha256: string;
    result: "pass";
    run_at: string;
  };
  procedure: { id: string; instruction: string }[];
  resources: Resource[];
  limitations: string[];
};

const manifestPattern =
  /^\/reproduction\/([a-z0-9][a-z0-9._-]{0,80})\/([a-f0-9]{64})\/manifest\.json$/;
const resourcePattern = /^(input|expected)\/[a-z0-9][a-z0-9._-]{0,80}$/;
const shaPattern = /^[a-f0-9]{64}$/;

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function loadReproductionKit(
  reference: ReproductionKitReference,
  expectedArticleId: string,
  projectRoot = process.cwd()
): PublicReproductionManifest {
  const matched = manifestPattern.exec(reference.manifestPath);
  if (
    !matched ||
    matched[1] !== expectedArticleId ||
    matched[2] !== reference.sha256
  ) {
    throw new Error("Reproduction kit reference does not match the article");
  }

  const manifestFile = join(
    projectRoot,
    "public",
    ...reference.manifestPath.slice(1).split("/")
  );
  const raw = readFileSync(manifestFile);
  if (sha256(raw) !== reference.sha256) {
    throw new Error("Reproduction kit manifest hash mismatch");
  }
  const manifest = JSON.parse(raw.toString("utf8")) as PublicReproductionManifest;
  if (
    manifest.schema !== "xici.reproduction-kit/v1" ||
    manifest.article_id !== expectedArticleId ||
    manifest.evidence?.result !== "pass" ||
    !Array.isArray(manifest.resources) ||
    !Array.isArray(manifest.procedure) ||
    !Array.isArray(manifest.limitations)
  ) {
    throw new Error("Reproduction kit manifest contract is invalid");
  }

  const manifestDirectory = dirname(reference.manifestPath);
  manifest.resources = manifest.resources.map(resource => {
    if (
      !resourcePattern.test(resource.path) ||
      !shaPattern.test(resource.sha256) ||
      !Number.isSafeInteger(resource.bytes) ||
      resource.bytes < 1
    ) {
      throw new Error("Reproduction kit resource contract is invalid");
    }
    const resourceFile = join(
      projectRoot,
      "public",
      ...manifestDirectory.slice(1).split("/"),
      ...resource.path.split("/")
    );
    const payload = readFileSync(resourceFile);
    if (
      payload.byteLength !== resource.bytes ||
      sha256(payload) !== resource.sha256
    ) {
      throw new Error("Reproduction kit resource hash mismatch");
    }
    return {
      ...resource,
      href: posix.join(manifestDirectory, resource.path),
    };
  });
  return manifest;
}

