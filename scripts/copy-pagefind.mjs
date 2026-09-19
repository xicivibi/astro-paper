import { cpSync } from "node:fs";

cpSync(new URL("../dist/pagefind/", import.meta.url), new URL("../public/pagefind/", import.meta.url), {
  recursive: true,
});
