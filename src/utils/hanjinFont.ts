import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

let fontFile: Promise<ArrayBuffer> | undefined;

export function loadHanjinFont(): Promise<ArrayBuffer> {
  fontFile ??= readFile(
    resolve("public/fonts/HanjinGroupSans-Regular.ttf")
  ).then(data =>
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  );
  return fontFile;
}
