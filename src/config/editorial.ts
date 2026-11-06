/**
 * Post ids kept routable with noindex while they are under editorial hold.
 *
 * The 2026-05 autopilot posts that used this hold were deleted on
 * 2026-10-24 (feature/adsense-readiness); their history stays in Git. The
 * mechanism remains so a future post can be held without new code.
 */
export const legacyHoldPostIds: readonly string[] = [];

export function isLegacyHoldPostId(
  id: string,
  ids: readonly string[] = legacyHoldPostIds
) {
  return ids.includes(id.replace(/\.(md|mdx)$/i, ""));
}

export function isLegacyHoldPostPath(
  pathname: string,
  ids: readonly string[] = legacyHoldPostIds
) {
  const normalized = pathname.replace(/\/+$/, "");
  return ids.some(id => normalized.endsWith(`/posts/${id}`));
}
