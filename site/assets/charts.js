// Hover layer for the static SVG charts built by tools/site/charts.py.
// Line charts: a crosshair snaps to the nearest year and a tooltip lists every series' value.
// Bar charts: hovering or focusing a bar shows its label and value.
// Tooltips only enhance: every value is also in the figure's data table.
(() => {
  const fmt = (v, unit) => {
    if (v == null) return 'n/a';
    if (unit === '$') {
      if (Math.abs(v) >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
      if (Math.abs(v) >= 1e9) return '$' + Math.round(v / 1e9) + 'B';
      return '$' + Math.round(v).toLocaleString('en-US');
    }
    if (unit === '%') return v.toFixed(1).replace(/\.0$/, '') + '%';
    return (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)).toLocaleString('en-US');
  };
  const NS = 'http://www.w3.org/2000/svg';
  // Each figure carries a wide and a narrow plot (CSS shows one); each plot has its own geometry.
  for (const plot of document.querySelectorAll('figure.chart .plot[data-chart]')) {
    const d = JSON.parse(plot.dataset.chart);
    const svg = plot.querySelector('svg');
    const tip = plot.querySelector('.tip');
    const place = (px, py) => {
      const r = plot.getBoundingClientRect();
      const x = Math.min(Math.max(px - r.left + 14, 4), r.width - tip.offsetWidth - 4);
      tip.style.left = x + 'px';
      tip.style.top = Math.max(py - r.top - tip.offsetHeight - 12, 4) + 'px';
    };
    if (d.kind === 'line') {
      const pw = d.w - d.pad.l - d.pad.r, ph = d.h - d.pad.t - d.pad.b;
      const X = x => d.pad.l + (x - d.x0) / (d.x1 - d.x0 || 1) * pw;
      const Y = y => d.pad.t + ph - (y - d.y0) / (d.y1 - d.y0) * ph;
      const years = [...new Set(d.series.flatMap(s => s.points.map(p => p[0])))].sort((a, b) => a - b);
      const cross = document.createElementNS(NS, 'line');
      cross.setAttribute('class', 'cross');
      cross.setAttribute('y1', d.pad.t); cross.setAttribute('y2', d.h - d.pad.b);
      cross.style.display = 'none';
      svg.appendChild(cross);
      const marks = d.series.map(s => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', 4.5); c.setAttribute('class', 'hov ' + s.role);
        c.style.display = 'none'; svg.appendChild(c); return c;
      });
      const show = (year, cx, cy) => {
        const x = X(year);
        cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.style.display = '';
        const rows = d.series.map((s, i) => {
          const p = s.points.find(q => q[0] === year);
          if (p) { marks[i].setAttribute('cx', x); marks[i].setAttribute('cy', Y(p[1])); marks[i].style.display = ''; }
          else marks[i].style.display = 'none';
          return `<li><i class="${s.role}"></i>${s.name}<b>${fmt(p ? p[1] : null, d.unit)}</b></li>`;
        });
        tip.innerHTML = `<strong>${year}</strong><ul>${rows.join('')}</ul>`;
        tip.hidden = false; place(cx, cy);
      };
      const hide = () => { tip.hidden = true; cross.style.display = 'none'; marks.forEach(m => m.style.display = 'none'); };
      svg.addEventListener('pointermove', e => {
        const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        if (loc.x < d.pad.l - 10 || loc.x > d.w - d.pad.r + 10) return hide();
        const yr = d.x0 + (loc.x - d.pad.l) / pw * (d.x1 - d.x0);
        const near = years.reduce((a, b) => Math.abs(b - yr) < Math.abs(a - yr) ? b : a);
        show(near, e.clientX, e.clientY);
      });
      svg.addEventListener('pointerleave', hide);
      svg.setAttribute('tabindex', '0');
      let k = years.length - 1;
      svg.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        k = Math.max(0, Math.min(years.length - 1, k + (e.key === 'ArrowRight' ? 1 : -1)));
        const r = svg.getBoundingClientRect();
        show(years[k], r.left + X(years[k]) / d.w * r.width, r.top + 40);
      });
      svg.addEventListener('blur', hide);
    } else if (d.kind === 'bars') {
      svg.querySelectorAll('path.bar').forEach((bar, i) => {
        const b = d.bars[i];
        bar.setAttribute('tabindex', '0');
        const on = e => {
          tip.innerHTML = `<strong>${b.label}</strong><ul><li>${b.text || fmt(b.value, d.unit)}</li></ul>`;
          tip.hidden = false;
          const r = bar.getBoundingClientRect();
          place(e.clientX ?? r.right, e.clientY ?? r.top);
        };
        bar.addEventListener('pointermove', on);
        bar.addEventListener('focus', on);
        bar.addEventListener('pointerleave', () => { tip.hidden = true; });
        bar.addEventListener('blur', () => { tip.hidden = true; });
      });
    }
  }
})();
