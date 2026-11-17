"""Tests for tools/site/charts.py. Run: python3 -m unittest tools/site/test_charts.py"""
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).parent))
import charts  # noqa: E402

SRC = [["Example source", "https://example.org/data"]]


def line_spec(**kw):
    spec = {"id": "t", "kind": "line", "num": "Figure 1", "title": "T", "subtitle": "S", "alt": "A", "sources": SRC,
            "unit": "", "series": [
                {"name": "Tuition", "role": "cost", "points": [[1980, 100], [2000, 300], [2020, 550]]},
                {"name": "Prices", "role": "context", "points": [[1980, 100], [2000, 210], [2020, 315]]}]}
    spec.update(kw)
    return spec


class LineChart(unittest.TestCase):
    def test_has_legend_end_labels_dots_table_and_payload(self):
        out = charts.render(line_spec())
        self.assertIn("class=legend", out)
        self.assertEqual(out.count("<circle"), 4)  # two series, wide and narrow plots
        self.assertEqual(out.count("class=endn"), 4)
        self.assertIn("<details><summary>Show the data</summary><table>", out)
        payload = json.loads(re.search(r"data-chart='([^']*)'", out).group(1).replace("&quot;", '"'))
        self.assertEqual(payload["x0"], 1980)
        self.assertEqual(payload["y0"], 0)

    def test_wide_and_narrow_plots(self):
        out = charts.render(line_spec())
        self.assertIn('class="plot wide"', out)
        self.assertIn('class="plot narrow"', out)
        self.assertIn('viewBox="0 0 380', out)

    def test_single_series_has_no_legend(self):
        spec = line_spec(series=[line_spec()["series"][0]])
        self.assertNotIn("class=legend", charts.render(spec))

    def test_context_series_is_drawn_first_and_listed_last(self):
        out = charts.render(line_spec())
        self.assertLess(out.index("ln context"), out.index("ln cost"))
        legend = re.search(r"<ul class=legend>(.*?)</ul>", out).group(1)
        self.assertLess(legend.index("Tuition"), legend.index("Prices"))

    def test_point_outside_axis_raises(self):
        with self.assertRaises(ValueError):
            charts.render(line_spec(y_max=400))

    def test_empty_series_raises(self):
        spec = line_spec()
        spec["series"][0]["points"] = []
        with self.assertRaises(ValueError):
            charts.render(spec)


class BarChart(unittest.TestCase):
    def spec(self):
        return {"id": "b", "kind": "bars", "num": "Figure 2", "title": "T", "subtitle": "S", "alt": "A", "sources": SRC,
                "unit": "$", "bars": [{"label": "Bachelor's", "value": 1500}, {"label": "High school", "value": 900}]}

    def test_value_at_each_tip_in_order(self):
        out = charts.render(self.spec())
        self.assertEqual(re.findall(r"class=bval[^>]*>([^<]*)<", out), ["$1,500", "$900"] * 2)

    def test_zero_and_tiny_bars_draw_valid_paths(self):
        spec = self.spec()
        spec["bars"].append({"label": "Free", "value": 0, "text": "about $0"})
        out = charts.render(spec)
        for d in re.findall(r' d="([^"]*)"', out):
            self.assertNotIn("--", d)
        self.assertIn("about $0", out)

    def test_no_legend_for_one_series(self):
        self.assertNotIn("class=legend", charts.render(self.spec()))


class Guards(unittest.TestCase):
    def test_unknown_kind_raises(self):
        with self.assertRaises(ValueError):
            charts.render({"id": "x", "kind": "pie"})

    def test_dashes_are_refused(self):
        with self.assertRaises(ValueError):
            charts.render(line_spec(title="Costs — rising"))

    def test_fmt(self):
        self.assertEqual(charts.fmt(1_640_000_000_000, "$"), "$1.64T")
        self.assertEqual(charts.fmt(2_000_000_000_000, "$"), "$2T")
        self.assertEqual(charts.fmt(28950, "$"), "$28.9K")
        self.assertEqual(charts.fmt(22500, "$"), "$22.5K")
        self.assertEqual(charts.fmt(30000, "$"), "$30K")
        self.assertEqual(charts.fmt(40, "%"), "40%")


if __name__ == "__main__":
    unittest.main()
