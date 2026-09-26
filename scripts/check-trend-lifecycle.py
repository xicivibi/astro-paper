"""Check whether published static trend pages need a lifecycle rebuild.

Only stdlib is used so the scheduled GitHub job needs no extra runtime or API
token. A deploy hook is called by the workflow only when this proves staleness.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.error
import urllib.request


_BUNDLE = re.compile(r"^trendBundle: (\{.*\})$", re.MULTILINE)
_PUBLISHED = re.compile(r"^pubDatetime: (\S+)$", re.MULTILINE)


class _PageSignals(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.noindex = False
        self.bundle = False
        self.review_due = False
        self.offers: list[tuple[str | None, str | None]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "meta" and values.get("name") == "robots":
            self.noindex |= "noindex" in (values.get("content") or "").split(",")[0]
        self.bundle |= "data-trend-bundle" in values
        self.review_due |= "data-trend-review-due" in values
        if tag == "a" and "data-affiliate-offer" in values:
            self.offers.append((values.get("data-expires-at"), values.get("href")))


def _instant(value: str) -> datetime:
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError("trend lifecycle timestamp must include a timezone")
    return timestamp.astimezone(timezone.utc)


def _documents(root: Path):
    for path in sorted(root.glob("xici-trend-*.md")):
        text = path.read_text(encoding="utf-8")
        bundle_match = _BUNDLE.search(text)
        published_match = _PUBLISHED.search(text)
        if not bundle_match or not published_match:
            raise ValueError(f"trend document metadata is missing: {path.name}")
        bundle = json.loads(bundle_match.group(1))
        if bundle.get("schemaVersion") != "trend-bundle-v1":
            raise ValueError(f"trend schema is unsupported: {path.name}")
        yield path.stem, _instant(published_match.group(1)), bundle


def needs_rebuild(root: Path, origin: str, *, now: datetime, fetch=None) -> list[str]:
    """Return exact reasons; a transient fetch failure is not proof of staleness."""
    instant = now.astimezone(timezone.utc)
    if origin != "https://xici.vercel.app":
        raise ValueError("lifecycle probe requires the configured Xici origin")
    fetch = fetch or _fetch
    reasons: list[str] = []
    for slug, published, bundle in _documents(root):
        if published > instant:
            continue
        url = f"{origin}/posts/{slug}/"
        try:
            html = fetch(url)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                reasons.append(f"{slug}:missing_page")
                continue
            raise
        signals = _PageSignals()
        signals.feed(html)
        if not signals.bundle:
            reasons.append(f"{slug}:missing_bundle")
            continue
        expired = instant >= _instant(bundle["freshUntil"])
        review_due = instant >= _instant(bundle["reviewDueAt"])
        if expired and not signals.noindex:
            reasons.append(f"{slug}:expired_page_indexable")
        if review_due and not signals.review_due:
            reasons.append(f"{slug}:review_notice_missing")
        if any(
            href and (expired or instant >= _instant(expires_at or ""))
            for expires_at, href in signals.offers
        ):
            reasons.append(f"{slug}:expired_offer_link")
    return reasons


def _fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "xici-lifecycle-check/1.0"})
    with urllib.request.urlopen(request, timeout=10) as response:
        if response.url != url or response.status != 200:
            raise ValueError("lifecycle probe response is not the exact page")
        body = response.read(512_001)
    if len(body) > 512_000:
        raise ValueError("lifecycle probe page exceeds 512KB")
    return body.decode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--posts", type=Path, default=Path("src/content/posts"))
    parser.add_argument("--origin", default="https://xici.vercel.app")
    parser.add_argument("--github-output", type=Path)
    args = parser.parse_args()
    reasons = needs_rebuild(args.posts, args.origin, now=datetime.now(timezone.utc))
    print(json.dumps({"needs_rebuild": bool(reasons), "reasons": reasons}, sort_keys=True))
    if args.github_output:
        with args.github_output.open("a", encoding="utf-8") as handle:
            handle.write(f"needs_rebuild={'true' if reasons else 'false'}\n")


if __name__ == "__main__":
    main()
