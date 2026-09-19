export const legacyHoldPostIds = [
  "post-20260522-133242-18842b6cde",
  "post-20260522-133424-1aed1c7a14",
  "post-20260522-133657-41a807345c",
  "post-20260522-133839-f545a4c6bc",
  "post-20260522-140131-483ded350c",
  "post-20260522-144944-d68d913c30",
  "post-20260522-145036-603a6a35f7",
  "post-20260522-145149-4de8efdb4a",
  "post-20260522-145238-989ab005e8",
  "post-20260522-151430-02ce2a7049",
  "post-20260523-005838-fb3346f2d0",
  "post-20260523-005928-698bb43437",
  "post-20260523-020133-c2d81e6360",
  "post-20260523-024532-cbb010c382",
  "post-20260523-065936-bd9c476746",
] as const;

const legacyHoldPostIdSet = new Set<string>(legacyHoldPostIds);

export function isLegacyHoldPostId(id: string) {
  return legacyHoldPostIdSet.has(id.replace(/\.(md|mdx)$/i, ""));
}

export function isLegacyHoldPostPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "");
  return legacyHoldPostIds.some(id => normalized.endsWith(`/posts/${id}`));
}
