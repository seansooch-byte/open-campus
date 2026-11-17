"""Static SVG charts for the Open Campus landing page.

Each chart is drawn at build time from a spec (site/src/charts.json) so the page needs no
chart library. Every figure carries: an SVG plot, a legend for two or more series, selective
end labels, a data table twin (<details>), and a JSON payload that site/assets/charts.js reads
to add a hover crosshair and tooltip.

Expected behavior (the tests in tools/site/test_charts.py pin these):
- line(): one axis only; x from the data's year range; y from 0 (or the spec's y_min) to a
  rounded max; end label and end dot on every series; a series with role "context" is drawn
  in the muted gray and listed last in the legend.
- bars(): horizontal bars, one series, sorted as given, value printed at the bar tip.
- A spec with an unknown kind, an empty series, or a point outside the axis raises ValueError.
- Output never contains an em dash or an en dash.
"""
from __future__ import annotations

import html
import json
import math

ROLE_VAR = {
    "cost": "var(--s-cost)",
    "compare": "var(--s-compare)",
    "third": "var(--s-third)",
    "context": "var(--s-context)",
}


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def nice_max(v: float) -> float:
    if v <= 0:
        return 1
    exp = 10 ** math.floor(math.log10(v))
    for m in (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if v <= m * exp:
            return m * exp
    return 10 * exp


def ticks(lo: float, hi: float, n: int = 5) -> list[float]:
    step = (hi - lo) / n
    return [lo + i * step for i in range(n + 1)]


def fmt(v: float, unit: str = "") -> str:
    if unit == "$":
        if abs(v) >= 1e12:
            return "$" + f"{v/1e12:.2f}".rstrip("0").rstrip(".") + "T"
        if abs(v) >= 1e9:
            return f"${v/1e9:.0f}B"
        if abs(v) >= 10000:
            return "$" + f"{v/1000:.1f}".rstrip("0").rstrip(".") + "K"
        return f"${v:,.0f}"
    if unit == "%":
        return f"{v:.0f}%"
    if abs(v) >= 1e6:
        return f"{v/1e6:.1f}M".replace(".0M", "M")
    if abs(v) >= 10000:
        return f"{v/1000:.0f}K"
    return f"{v:,.0f}" if float(v).is_integer() or abs(v) >= 100 else f"{v:,.1f}"


def _check_text(out: str) -> str:
    if "—" in out or "–" in out:
        raise ValueError("chart text contains an em or en dash")
    return out


def table(spec: dict) -> str:
    if spec["kind"] == "line":
        years = sorted({p[0] for s in spec["series"] for p in s["points"]})
        head = "".join(f"<th scope=col>{esc(s['name'])}</th>" for s in spec["series"])
        rows = []
        for y in years:
            cells = []
            for s in spec["series"]:
                v = dict((p[0], p[1]) for p in s["points"]).get(y)
                cells.append(f"<td>{esc(fmt(v, spec.get('unit','')) if v is not None else '')}</td>")
            rows.append(f"<tr><th scope=row>{esc(y)}</th>{''.join(cells)}</tr>")
        return f"<table><thead><tr><th scope=col>{esc(spec.get('x_label','Year'))}</th>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table>"
    rows = "".join(f"<tr><th scope=row>{esc(b['label'])}</th><td>{esc(fmt(b['value'], spec.get('unit','')))}</td></tr>" for b in spec["bars"])
    return f"<table><thead><tr><th scope=col>Group</th><th scope=col>{esc(spec.get('value_label','Value'))}</th></tr></thead><tbody>{rows}</tbody></table>"


GEOMS = {
    "wide": {"w": 720, "h": 380, "pad": {"l": 56, "r": 170, "t": 20, "b": 40}},
    "narrow": {"w": 380, "h": 330, "pad": {"l": 44, "r": 108, "t": 16, "b": 34}},
}


def _check_series(spec: dict):
    series = spec["series"]
    if not series or any(not s["points"] for s in series):
        raise ValueError(f"{spec['id']}: empty series")
    xs = [p[0] for s in series for p in s["points"]]
    ys = [p[1] for s in series for p in s["points"]]
    y0 = spec.get("y_min", 0)
    y1 = nice_max(max(ys)) if "y_max" not in spec else spec["y_max"]
    if min(ys) < y0 or max(ys) > y1:
        raise ValueError(f"{spec['id']}: a point is outside the axis")
    return min(xs), max(xs), y0, y1


def line_plot(spec: dict, geom: dict):
    series = spec["series"]
    x0, x1, y0, y1 = _check_series(spec)
    W, H, PAD = geom["w"], geom["h"], geom["pad"]
    narrow = W < 500
    pw, ph = W - PAD["l"] - PAD["r"], H - PAD["t"] - PAD["b"]
    X = lambda x: PAD["l"] + (x - x0) / (x1 - x0 or 1) * pw
    Y = lambda y: PAD["t"] + ph - (y - y0) / (y1 - y0) * ph
    unit = spec.get("unit", "")
    g = []
    for t in ticks(y0, y1, 5):
        g.append(f'<line class=grid x1={PAD["l"]} x2={W-PAD["r"]} y1={Y(t):.1f} y2={Y(t):.1f} />'
                 f'<text class=tick x={PAD["l"]-8} y={Y(t)+4:.1f} text-anchor=end>{esc(fmt(t, unit))}</text>')
    span = x1 - x0
    step = (20 if narrow else 10) if span > 30 else (10 if narrow else 5) if span > 12 else 2 if span > 6 else 1
    for x in range(math.ceil(x0 / step) * step, x1 + 1, step):
        g.append(f'<text class=tick x={X(x):.1f} y={H-PAD["b"]+22} text-anchor=middle>{x}</text>')
    if spec.get("baseline") is not None:
        b = spec["baseline"]
        g.append(f'<line class=base x1={PAD["l"]} x2={W-PAD["r"]} y1={Y(b):.1f} y2={Y(b):.1f} />')
    order = sorted(series, key=lambda s: s.get("role") == "context", reverse=True)
    labels = []
    for s in order:
        color = ROLE_VAR[s.get("role", "compare")]
        pts = sorted(s["points"])
        d = " ".join(f"{'M' if i == 0 else 'L'}{X(x):.1f},{Y(y):.1f}" for i, (x, y) in enumerate(pts))
        g.append(f'<path class="ln {esc(s.get("role","compare"))}" d="{d}" style="stroke:{color}" />')
        lx, ly = pts[-1]
        g.append(f'<circle class=dot cx={X(lx):.1f} cy={Y(ly):.1f} r=4.5 style="fill:{color}" />')
        labels.append([Y(ly), s, lx, ly])
    labels.sort(key=lambda r: r[0])
    gap = 32 if narrow else 34
    for i in range(1, len(labels)):
        if labels[i][0] - labels[i - 1][0] < gap:
            labels[i][0] = labels[i - 1][0] + gap
    lx0 = X(x1) + (16 if narrow else 22)
    for ty, s, lx, ly in labels:
        g.append(f'<line class=leader x1={X(lx)+6:.1f} y1={Y(ly):.1f} x2={lx0-4:.1f} y2={ty:.1f} />')
        g.append(f'<text class=end x={lx0:.1f} y={ty+4:.1f}><tspan class=endv>{esc(s.get("end_value", fmt(ly, unit)))}</tspan>'
                 f'<tspan class=endn x={lx0:.1f} dy=15>{esc(s.get("short", s["name"]))}</tspan></text>')
    payload = {"kind": "line", "unit": unit, "x0": x0, "x1": x1, "y0": y0, "y1": y1, "pad": PAD, "w": W, "h": H,
               "series": [{"name": s["name"], "role": s.get("role", "compare"), "points": sorted(s["points"])} for s in series]}
    return "".join(g), payload, H


def _bar_path(x, y, w, hgt):
    if w >= 8:
        return f"M{x},{y} h{w-4:.1f} a4,4 0 0 1 4,4 v{hgt-8} a4,4 0 0 1 -4,4 h-{w-4:.1f} z"
    return f"M{x},{y} h{w:.1f} v{hgt} h-{w:.1f} z"  # too short to round: a sliver, so a zero still shows


def bars_plot(spec: dict, geom: dict):
    items = spec["bars"]
    if not items:
        raise ValueError(f"{spec['id']}: empty bars")
    unit = spec.get("unit", "")
    vmax = nice_max(max(b["value"] for b in items))
    W, PAD = geom["w"], geom["pad"]
    narrow = W < 500
    g = []
    if narrow:  # label above each bar, bars full width
        left, band, top = 4, 58, PAD["t"]
        pw = W - left - 70
        for i, b in enumerate(items):
            y = top + i * band
            w = max(2, b["value"] / vmax * pw)
            role = b.get("role", "compare")
            g.append(f'<text class=blabel x={left} y={y+14}>{esc(b["label"])}</text>')
            g.append(f'<path class="bar {esc(role)}" style="fill:{ROLE_VAR[role]}" d="{_bar_path(left, y+22, w, 22)}" />')
            g.append(f'<text class=bval x={left+w+8:.1f} y={y+38}>{esc(b.get("text", fmt(b["value"], unit)))}</text>')
        h = top + band * len(items) + 4
    else:
        left, band = spec.get("label_width", 230), 44
        pw = W - left - 90
        for i, b in enumerate(items):
            y = PAD["t"] + i * band
            w = max(2, b["value"] / vmax * pw)
            role = b.get("role", "compare")
            g.append(f'<text class=blabel x={left-12} y={y+band/2+5:.1f} text-anchor=end>{esc(b["label"])}</text>')
            g.append(f'<path class="bar {esc(role)}" style="fill:{ROLE_VAR[role]}" d="{_bar_path(left, y+10, w, band-20)}" />')
            g.append(f'<text class=bval x={left+w+8:.1f} y={y+band/2+5:.1f}>{esc(b.get("text", fmt(b["value"], unit)))}</text>')
        h = PAD["t"] + band * len(items) + 16
        g.append(f'<line class=base x1={left} x2={left} y1={PAD["t"]} y2={h-12} />')
    payload = {"kind": "bars", "unit": unit, "bars": items}
    return "".join(g), payload, h


def _figure(spec: dict, plot) -> str:
    legend = ""
    if spec["kind"] == "line" and len(spec["series"]) > 1:
        keys = sorted(spec["series"], key=lambda s: s.get("role") == "context")
        legend = "<ul class=legend>" + "".join(
            f'<li><i style="background:{ROLE_VAR[s.get("role","compare")]}"></i>{esc(s["name"])}</li>' for s in keys) + "</ul>"
    src = "; ".join(f'<a href="{esc(u)}">{esc(n)}</a>' for n, u in spec["sources"])
    plots = []
    for name, geom in GEOMS.items():
        inner, payload, height = plot(spec, geom)
        plots.append(f'<div class="plot {name}" data-chart=\'{esc(json.dumps(payload, separators=(",", ":")))}\'>'
                     f'<svg viewBox="0 0 {geom["w"]} {height}" role=img aria-label="{esc(spec["alt"])}">{inner}</svg><div class=tip hidden></div></div>')
    out = (f'<figure class=chart id="fig-{esc(spec["id"])}">'
           f'<figcaption><span class=fignum>{esc(spec["num"])}</span><b>{esc(spec["title"])}</b>'
           f'<span class=sub>{esc(spec["subtitle"])}</span></figcaption>{legend}{"".join(plots)}'
           f'<p class=source>Source: {src}. {esc(spec.get("note",""))}</p>'
           f'<details><summary>Show the data</summary>{table(spec)}</details></figure>')
    return _check_text(out)


def line(spec: dict) -> str:
    return _figure(spec, line_plot)


def bars(spec: dict) -> str:
    return _figure(spec, bars_plot)


def render(spec: dict) -> str:
    kind = spec.get("kind")
    if kind == "line":
        return line(spec)
    if kind == "bars":
        return bars(spec)
    raise ValueError(f"{spec.get('id')}: unknown chart kind {kind!r}")
