/** A merchant search destination, never a product recommendation or affiliate URL. */
export function coupangSearchUrl(query: string): string | null {
  if (
    query !== query.trim() ||
    query.length < 2 ||
    query.length > 60 ||
    /[\u0000-\u001f\u007f]/u.test(query)
  ) {
    return null;
  }
  const url = new URL("https://www.coupang.com/np/search");
  url.searchParams.set("q", query);
  return url.toString();
}
