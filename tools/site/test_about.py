"""Tests for tools/site/build.py, which writes site/about/index.html from site/src/about.html."""
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
import build  # noqa: E402

PAGE = '<p>Claim.<sup><a href="#r1">1</a></sup></p><ol><li id="r1">Source.</li></ol>'


class AboutBuild(unittest.TestCase):
    def test_real_page_builds(self):
        html = build.check((build.SRC / "about.html").read_text())
        self.assertIn('aria-current="page">About', html)

    def test_a_citation_without_a_source_fails(self):
        with self.assertRaises(SystemExit):
            build.check(PAGE.replace('href="#r1"', 'href="#r2"'))

    def test_a_source_nobody_cites_fails(self):
        with self.assertRaises(SystemExit):
            build.check(PAGE + '<li id="r2">Unused.</li>')

    def test_dashes_and_tokens_fail(self):
        for bad in ("a — b", "a – b", "{{chart:x}}"):
            with self.assertRaises(SystemExit, msg=bad):
                build.check(PAGE + bad)

    def test_a_clean_page_passes_through_unchanged(self):
        self.assertEqual(build.check(PAGE), PAGE)


if __name__ == "__main__":
    unittest.main()
