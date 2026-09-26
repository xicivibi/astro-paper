import importlib.util
from datetime import datetime, timezone
import json
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location(
    "trend_lifecycle", Path(__file__).with_name("check-trend-lifecycle.py")
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TrendLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        bundle = {
            "schemaVersion": "trend-bundle-v1",
            "freshUntil": "2026-09-27T12:00:00+00:00",
            "reviewDueAt": "2026-09-27T06:00:00+00:00",
        }
        (self.root / "xici-trend-example.md").write_text(
            "---\npubDatetime: 2026-09-27T02:00:00+00:00\n"
            + "trendBundle: " + json.dumps(bundle) + "\n---\n",
            encoding="utf-8",
        )
        self.url = "https://xici.vercel.app/posts/xici-trend-example/"

    def test_review_due_and_expired_offer_trigger_rebuild_once(self):
        html = (
            '<html><div data-trend-bundle></div>'
            '<a data-affiliate-offer data-expires-at="2026-09-27T05:00:00Z" '
            'href="https://link.coupang.com/a/example">offer</a></html>'
        )
        reasons = module.needs_rebuild(
            self.root, "https://xici.vercel.app",
            now=datetime(2026, 9, 27, 7, tzinfo=timezone.utc),
            fetch=lambda url: html if url == self.url else self.fail(url),
        )
        self.assertEqual(reasons, [
            "xici-trend-example:review_notice_missing",
            "xici-trend-example:expired_offer_link",
        ])
        rebuilt = (
            '<html><div data-trend-bundle data-trend-review-due></div></html>'
        )
        self.assertEqual(module.needs_rebuild(
            self.root, "https://xici.vercel.app",
            now=datetime(2026, 9, 27, 7, tzinfo=timezone.utc),
            fetch=lambda _url: rebuilt,
        ), [])

    def test_expired_page_requires_noindex_and_no_live_offer(self):
        stale = '<html><div data-trend-bundle data-trend-review-due></div></html>'
        now = datetime(2026, 9, 27, 13, tzinfo=timezone.utc)
        self.assertEqual(module.needs_rebuild(
            self.root, "https://xici.vercel.app", now=now, fetch=lambda _url: stale,
        ), ["xici-trend-example:expired_page_indexable"])
        current = (
            '<html><meta name="robots" content="noindex, nofollow">'
            '<div data-trend-bundle data-trend-review-due></div></html>'
        )
        self.assertEqual(module.needs_rebuild(
            self.root, "https://xici.vercel.app", now=now, fetch=lambda _url: current,
        ), [])


if __name__ == "__main__":
    unittest.main()
