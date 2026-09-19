import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));

function readPost(slug: string) {
  return readFileSync(`${root}/src/content/posts/${slug}.md`, "utf8");
}

function assertTrustMetadata(post: string) {
  assert.match(post, /^aiAssisted: true$/m);
  assert.match(post, /^lastReviewed: 2026-09-20T\d{2}:\d{2}:00\+09:00$/m);
  assert.match(post, /^testingStatus: reproduced$/m);
  assert.match(post, /^sources:$/m);
  assert.match(post, /^## 이 글의 확인 범위$/m);
  assert.match(post, /Excel 16\.0 빌드 20326/);
}

test("folder-combine pilot stays bound to its verified scope", () => {
  const post = readPost("power-query-folder-combine-header-column-order");
  assertTrustMetadata(post);
  assert.match(
    post,
    /https:\/\/support\.microsoft\.com\/en-us\/excel\/import-data-from-a-folder-with-multiple-files-power-query/
  );
  assert.match(
    post,
    /5f79db79f6196736bee7991daf80e964364940121076e108172eb74c3db1fcbb/
  );
  assert.match(
    post,
    /ae3536b36843c5b0bad4b8bee9cd565a02d5f974fe021325c5694632fb8f7e92/
  );
  assert.match(post, /첫 로드 뒤 파일의 동적 추가·삭제/);
  assert.match(post, /원시 출력 순서/);
});

test("duplicate-removal pilot avoids promising a survivor", () => {
  const post = readPost("power-query-remove-duplicates-key-normalization");
  assertTrustMetadata(post);
  assert.match(
    post,
    /https:\/\/learn\.microsoft\.com\/en-us\/power-query\/working-with-duplicates/
  );
  assert.match(
    post,
    /0e100b2a503c572b63b323f32c1d6409c47e98f895cebc6f8b75f1e79ebc806d/
  );
  assert.match(
    post,
    /9002f6486d8a8070167364c8bc1539c517c5b5e08d4d8b4184f25b5832a1b014/
  );
  assert.match(post, /어떤 중복 행이 유지될지 보장되지/);
  assert.match(post, /특정 생존 행의 순서나 정체성/);
});
