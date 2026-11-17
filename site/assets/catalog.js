// Catalog search: filters programs by name, CIP code, exam or course, opens matching programs,
// hides colleges with no match, and reports the count. With an empty box everything shows, closed.
(() => {
  const q = document.getElementById('q');
  const count = document.getElementById('count');
  const empty = document.getElementById('empty');
  const progs = [...document.querySelectorAll('.prog')];
  const colleges = [...document.querySelectorAll('.college')];
  const total = progs.length;
  const run = () => {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const p of progs) {
      const hit = terms.every(t => p.dataset.search.includes(t));
      p.hidden = !hit;
      if (hit) shown++;
      const det = p.querySelector('details');
      if (det) det.open = terms.length > 0 && hit;
    }
    for (const c of colleges) c.hidden = !c.querySelector('.prog:not([hidden])');
    count.textContent = terms.length ? `${shown} of ${total} programs match` : `${total} programs`;
    empty.hidden = shown > 0;
  };
  q.addEventListener('input', run);
  const pre = new URLSearchParams(location.search).get('q');
  if (pre) q.value = pre;
  run();
})();
