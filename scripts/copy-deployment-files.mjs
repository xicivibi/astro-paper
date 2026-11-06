import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectInlineHashes,
  servesAds,
  serveHeaders,
} from "./serve-headers.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const destination = join(dist, "_headers");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(join(root, "deploy", "cloudflare-headers"), destination);

// Serve-mode builds get a hash-based script policy that admits AdSense.
if (servesAds(dist)) {
  writeFileSync(
    destination,
    serveHeaders(readFileSync(destination, "utf8"), collectInlineHashes(dist))
  );
  process.stdout.write("serve 모드: 인라인 스크립트 해시 기반 CSP를 _headers에 썼습니다.\n");
}
