"""Tests for the catalog data and page. Run: python3 -m unittest tools/site/test_catalog.py"""
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
import build_catalog  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "site" / "data" / "catalog.json").read_text())


class CatalogData(unittest.TestCase):
    def test_every_program_has_courses_and_anchors_or_is_a_partner(self):
        for c in DATA["colleges"]:
            for p in c["programs"]:
                if "partner" in p:
                    continue
                self.assertGreaterEqual(len(p["courses"]), 8, p["name"])
                self.assertGreaterEqual(len(p["anchors"]), 1, p["name"])

    def test_pre_medicine_is_a_partner_link_only(self):
        pre = [p for c in DATA["colleges"] for p in c["programs"] if p.get("cip") == "51.1102"]
        self.assertEqual(len(pre), 1)
        self.assertIn("partner", pre[0])
        self.assertNotIn("courses", pre[0])

    def test_no_course_is_anchored_to_the_mcat(self):
        self.assertNotIn("MCAT", json.dumps(DATA))

    def test_seed_is_sixty_majors_about_two_thirds_of_degrees(self):
        self.assertEqual(len(DATA["seed"]), 60)
        share = sum(s["degrees"] for s in DATA["seed"]) / DATA["bachelors_total"]
        self.assertAlmostEqual(share, 0.682, places=3)

    def test_every_program_is_listed_until_planned(self):
        tiers = {p.get("tier") for c in DATA["colleges"] for p in c["programs"] if "partner" not in p}
        self.assertEqual(tiers, {"T0"})


class CatalogPage(unittest.TestCase):
    def setUp(self):
        self.page = build_catalog.build()

    def test_no_dashes(self):
        self.assertNotRegex(self.page, "[–—]")

    def test_one_card_per_program_and_one_section_per_college(self):
        n = sum(len(c["programs"]) for c in DATA["colleges"])
        self.assertEqual(self.page.count("<li class=prog "), n)
        self.assertEqual(self.page.count("<section class=college "), len(DATA["colleges"]))

    def test_says_nothing_is_ready(self):
        self.assertIn("courses ready to study today", self.page)
        self.assertNotIn("outlined in a college", self.page)


if __name__ == "__main__":
    unittest.main()
