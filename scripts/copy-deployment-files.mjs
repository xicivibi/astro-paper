import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "dist", "_headers");

mkdirSync(dirname(destination), { recursive: true });
copyFileSync(join(root, "deploy", "cloudflare-headers"), destination);
