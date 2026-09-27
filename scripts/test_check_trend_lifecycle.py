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
mark_spec = importlib.util.spec_from_file_location(
    "mark_trend_lifecycle", Path(__file__).with_name("mark-trend-lifecycle.py")
)
mark_module = importlib.util.module_from_spec(mark_spec)
mark_spec.loader.exec_module(mark_module)


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

    def test_commercial_origin_and_duplicate_rebuild_marker(self):
        now = datetime(2026, 9, 27, 13, tzinfo=timezone.utc)
        self.assertEqual(module.needs_rebuild(
            self.root, "https://example.pages.dev", now=now,
            fetch=lambda url: '<html><div data-trend-bundle></div></html>'
            if url == "https://example.pages.dev/posts/xici-trend-example/"
            else self.fail(url),
        ), ["xici-trend-example:expired_page_indexable",
            "xici-trend-example:review_notice_missing"])
        with self.assertRaises(ValueError):
            module.needs_rebuild(self.root, "http://example.pages.dev", now=now)
        state = self.root / "state.json"
        first = "a" * 64
        self.assertTrue(mark_module.mark(state, first, now=now))
        original = state.read_bytes()
        self.assertFalse(mark_module.mark(state, first, now=now))
        self.assertEqual(state.read_bytes(), original)
        self.assertTrue(mark_module.mark(state, "b" * 64, now=now))

    def test_manual_trend_is_rebuilt_at_review_and_expiry(self):
        (self.root / "manual-shopping-trend.md").write_text(
            "---\npubDatetime: 2026-09-27T02:00:00+00:00\n"
            'trendLifecycle:\n'
            '  observedAt: 2026-09-27T02:00:00+00:00\n'
            '  reviewDueAt: 2026-09-27T06:00:00+00:00\n'
            '  freshUntil: 2026-09-27T12:00:00+00:00\n---\n',
            encoding="utf-8",
        )
        def page(url):
            if url == self.url:
                return '<html><div data-trend-bundle data-trend-review-due></div></html>'
            if url == "https://xici.vercel.app/posts/manual-shopping-trend/":
                return '<html><div data-trend-lifecycle></div></html>'
            self.fail(url)

        self.assertEqual(module.needs_rebuild(
            self.root, "https://xici.vercel.app",
            now=datetime(2026, 9, 27, 7, tzinfo=timezone.utc), fetch=page,
        ), ["manual-shopping-trend:review_notice_missing"])
        self.assertEqual(module.needs_rebuild(
            self.root, "https://xici.vercel.app",
            now=datetime(2026, 9, 27, 13, tzinfo=timezone.utc), fetch=page,
        ), ["manual-shopping-trend:expired_page_indexable",
            "manual-shopping-trend:review_notice_missing",
            "xici-trend-example:expired_page_indexable"])


if __name__ == "__main__":
    unittest.main()
