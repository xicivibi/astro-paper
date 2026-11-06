import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

let fontFile: Promise<ArrayBuffer> | undefined;

// satori renders OG images from TTF/OTF only, so the build reads the TTF; browsers get the WOFF2 in public/fonts.
export function loadSiteFont(): Promise<ArrayBuffer> {
  fontFile ??= readFile(
    resolve("src/assets/fonts/Pretendard-Regular.ttf")
  ).then(data =>
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  );
  return fontFile;
}
