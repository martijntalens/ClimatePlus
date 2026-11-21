/* ClimatePlus — dependency-free SVG charts */
(function () {
  'use strict';
  const CP = (window.CP = window.CP || {});
  let uid = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  CP.esc = esc;

  /* ------------------------------------------------------------------ */
  /* Scales & ticks                                                      */
  /* ------------------------------------------------------------------ */
  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return { lo, hi, step, ticks };
  }

  const MIN = 60000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  function timeTicks(t0, t1, width) {
    const span = t1 - t0;
    const max = Math.max(2, Math.floor(width / 84));
    const steps = [15 * MIN, 30 * MIN, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY];
    let step = steps.find((s) => span / s <= max) || steps[steps.length - 1];
    const ticks = [];
    const d = new Date(t0);
    if (step < DAY) {
      d.setMinutes(0, 0, 0);
      const stepH = step / HOUR;
      if (stepH >= 1) d.setHours(Math.ceil(d.getHours() / stepH) * stepH);
      let cursor = d.getTime();
      while (cursor < t0) cursor += step;
      for (; cursor <= t1; cursor += step) ticks.push({ t: cursor, kind: new Date(cursor).getHours() === 0 && new Date(cursor).getMinutes() === 0 ? 'day' : 'time' });
    } else if (step < 30 * DAY) {
      d.setHours(0, 0, 0, 0);
      const stepD = Math.round(step / DAY);
      while (d.getTime() < t0) d.setDate(d.getDate() + 1);
      while (d.getTime() <= t1) {
        ticks.push({ t: d.getTime(), kind: 'date' });
        d.setDate(d.getDate() + stepD);
      }
    } else {
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      const stepM = step >= 91 * DAY ? 3 : 1;
      while (d.getTime() < t0) d.setMonth(d.getMonth() + 1);
      while (d.getTime() <= t1) {
        ticks.push({ t: d.getTime(), kind: 'month' });
        d.setMonth(d.getMonth() + stepM);
      }
    }
    return ticks;
  }

  function tickLabel(tick) {
    const d = new Date(tick.t);
    const loc = CP.i18n.locale;
    if (tick.kind === 'time') return CP.fmt.time(d);
    if (tick.kind === 'day') return new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric' }).format(d);
    if (tick.kind === 'date') return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' }).format(d);
    return new Intl.DateTimeFormat(loc, { month: 'short' }).format(d);
  }

  function nearest(ts, target) {
    let lo = 0;
    let hi = ts.length - 1;
    if (hi < 0) return -1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] < target) lo = mid;
      else hi = mid;
    }
    return Math.abs(ts[lo] - target) <= Math.abs(ts[hi] - target) ? lo : hi;
  }

  /* ------------------------------------------------------------------ */
  /* Paths                                                               */
  /* ------------------------------------------------------------------ */
  function linePath(ts, vs, x, y) {
    let d = '';
    let pen = false;
    for (let i = 0; i < ts.length; i++) {
      const v = vs[i];
      if (v == null) { pen = false; continue; }
      d += (pen ? 'L' : 'M') + x(ts[i]).toFixed(1) + ',' + y(v).toFixed(1);
      pen = true;
    }
    return d;
  }
  function runs(ts, valid) {
    const out = [];
    let cur = null;
    for (let i = 0; i < ts.length; i++) {
      if (valid(i)) { if (!cur) { cur = []; out.push(cur); } cur.push(i); } else cur = null;
    }
    return out;
  }
  function areaPath(ts, vs, x, y, base) {
    return runs(ts, (i) => vs[i] != null)
      .map((run) => {
        let d = 'M' + x(ts[run[0]]).toFixed(1) + ',' + base.toFixed(1);
        run.forEach((i) => (d += 'L' + x(ts[i]).toFixed(1) + ',' + y(vs[i]).toFixed(1)));
        d += 'L' + x(ts[run[run.length - 1]]).toFixed(1) + ',' + base.toFixed(1) + 'Z';
        return d;
      })
      .join('');
  }
  function bandPath(ts, lo, hi, x, y) {
    return runs(ts, (i) => lo[i] != null && hi[i] != null)
      .map((run) => {
        let d = '';
        run.forEach((i, k) => (d += (k ? 'L' : 'M') + x(ts[i]).toFixed(1) + ',' + y(hi[i]).toFixed(1)));
        for (let k = run.length - 1; k >= 0; k--) d += 'L' + x(ts[run[k]]).toFixed(1) + ',' + y(lo[run[k]]).toFixed(1);
        return d + 'Z';
      })
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* Resize handling                                                     */
  /* ------------------------------------------------------------------ */
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver((entries) => entries.forEach((e) => {
      const el = e.target;
      const w = Math.round(e.contentRect.width);
      if (el.__draw && w && w !== el.__w) { el.__w = w; el.__draw(); }
    }))
    : null;
  function mount(el, drawFn) {
    el.__draw = drawFn;
    el.__w = el.clientWidth;
    if (observer && !el.__observed) { observer.observe(el); el.__observed = true; }
    drawFn();
  }

  function tooltip(el) {
    let tt = el.querySelector(':scope > .tt');
    if (!tt) {
      tt = document.createElement('div');
      tt.className = 'tt';
      tt.setAttribute('role', 'status');
      el.appendChild(tt);
    }
    return tt;
  }
  function placeTooltip(el, tt, px, py) {
    const w = el.clientWidth;
    tt.style.display = 'block';
    const tw = tt.offsetWidth;
    let left = px + 14;
    if (left + tw > w - 4) left = px - tw - 14;
    tt.style.left = Math.max(4, left) + 'px';
    tt.style.top = Math.max(0, py - tt.offsetHeight / 2) + 'px';
  }

  /* ------------------------------------------------------------------ */
  /* Touch: a tap pins the tooltip until the user taps somewhere else    */
  /* ------------------------------------------------------------------ */
  let pinned = null; // { el, clear }
  function pin(el, clear) {
    if (pinned && pinned.el !== el) pinned.clear();
    pinned = { el, clear };
    el.classList.add('pinned');
  }
  function unpin() {
    if (!pinned) return;
    const p = pinned;
    pinned = null;
    p.el.classList.remove('pinned');
    p.clear();
  }
  const isPinned = (el) => !!pinned && pinned.el === el;
  /** forget a pin when the chart is redrawn (its tooltip is gone) */
  function resetPin(el) {
    if (isPinned(el)) { pinned = null; el.classList.remove('pinned'); }
  }
  const isTouch = (ev) => ev.pointerType === 'touch' || ev.pointerType === 'pen';
  // A tap (not a scroll) outside the pinned chart releases it.
  let tapStart = null;
  let lastPointerType = 'mouse';
  document.addEventListener('pointerdown', (ev) => { tapStart = { x: ev.clientX, y: ev.clientY }; lastPointerType = ev.pointerType; }, true);
  document.addEventListener('pointerup', (ev) => {
    if (!pinned || !tapStart) return;
    const moved = Math.abs(ev.clientX - tapStart.x) + Math.abs(ev.clientY - tapStart.y) > 10;
    if (!moved && !pinned.el.contains(ev.target)) unpin();
  }, true);
  // Long-press on a chart should not open the text-selection / context menu
  document.addEventListener('contextmenu', (ev) => {
    if (lastPointerType !== 'mouse' && ev.target.closest && ev.target.closest('.chart')) ev.preventDefault();
  });

  /**
   * Wire pointer handling for a chart. show(ev) draws the tooltip for the event
   * position and returns false when there is nothing to show; clear() hides it.
   * Mouse: hover. Touch: tap pins, horizontal drag scrubs, vertical drag scrolls.
   */
  function interact(el, target, show, clear) {
    let start = null;
    target.addEventListener('pointerdown', (ev) => {
      if (!isTouch(ev)) { show(ev); return; }
      start = { x: ev.clientX, y: ev.clientY };
    });
    target.addEventListener('pointermove', (ev) => {
      if (!isTouch(ev)) { if (!isPinned(el)) show(ev); return; }
      if (start && Math.abs(ev.clientX - start.x) > Math.abs(ev.clientY - start.y)) show(ev);
    });
    target.addEventListener('pointerup', (ev) => {
      if (!isTouch(ev) || !start) return;
      start = null;
      if (show(ev) === false) { if (isPinned(el)) unpin(); else clear(); return; }
      pin(el, clear);
    });
    target.addEventListener('pointercancel', () => { start = null; if (!isPinned(el)) clear(); });
    target.addEventListener('pointerleave', (ev) => { if (!isTouch(ev) && !isPinned(el)) clear(); });
  }

  /* ------------------------------------------------------------------ */
  /* Line chart                                                          */
  /* ------------------------------------------------------------------ */
  /**
   * opts: { series:[{name,color,t,v,mn,mx,dashed,hidden}], height, format(v), start, end,
   *         band:[lo,hi,label], segments:[{from,to,color,label}], showRange, yMin, yMax, area }
   */
  function lineChart(el, opts) {
    el.classList.add('chart');
    mount(el, () => drawLine(el, opts));
  }

  function drawLine(el, o) {
    const W = Math.max(260, el.clientWidth || 600);
    const H = o.height || 260;
    const m = { l: 48, r: 16, t: 16, b: 30 };
    const series = (o.series || []).filter((s) => !s.hidden && s.t && s.t.length && s.v.some((v) => v != null));
    if (!series.length) {
      el.innerHTML = '<div class="empty" style="height:' + H + 'px">' + esc(CP.t('no_data')) + '</div>';
      return;
    }
    const t0 = o.start != null ? o.start : Math.min.apply(null, series.map((s) => s.t[0]));
    const t1 = o.end != null ? o.end : Math.max.apply(null, series.map((s) => s.t[s.t.length - 1]));
    let lo = Infinity;
    let hi = -Infinity;
    series.forEach((s) => {
      const useRange = o.showRange && series.length === 1 && s.mn;
      s.v.forEach((v, i) => {
        if (v == null) return;
        const a = useRange && s.mn[i] != null ? s.mn[i] : v;
        const b = useRange && s.mx[i] != null ? s.mx[i] : v;
        if (a < lo) lo = a;
        if (b > hi) hi = b;
      });
    });
    if (o.band && o.bandInDomain !== false) {
      const pad = (hi - lo) * 0.6 + 1;
      if (o.band[0] > lo - pad) lo = Math.min(lo, o.band[0]);
      if (o.band[1] < hi + pad) hi = Math.max(hi, o.band[1]);
    }
    if (o.yMin != null) lo = Math.min(lo, o.yMin);
    if (o.yMax != null) hi = Math.max(hi, o.yMax);
    const padY = (hi - lo) * 0.08 || 1;
    const ticks = niceTicks(lo - padY, hi + padY, Math.max(3, Math.round((H - m.t - m.b) / 52)));
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const x = (tt) => m.l + ((tt - t0) / (t1 - t0 || 1)) * pw;
    const y = (v) => m.t + (1 - (v - ticks.lo) / (ticks.hi - ticks.lo)) * ph;
    const base = y(ticks.lo);
    const fmtV = o.format || ((v) => CP.fmt.num(v, 1));
    const id = 'c' + ++uid;

    let svg = '<svg class="lc" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || series.map((s) => s.name).join(', ')) + '">';
    svg += '<defs>';
    series.forEach((s, i) => {
      svg += '<linearGradient id="' + id + 'g' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + s.color + '" stop-opacity=".28"/><stop offset="1" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>';
    });
    svg += '</defs>';

    // segments (heating / window open)
    (o.segments || []).forEach((sg) => {
      const a = Math.max(m.l, x(sg.from));
      const b = Math.min(m.l + pw, x(sg.to));
      if (b - a > 0.5) svg += '<rect class="seg" x="' + a.toFixed(1) + '" y="' + m.t + '" width="' + (b - a).toFixed(1) + '" height="' + ph + '" fill="' + sg.color + '"/>';
    });
    // comfort band
    if (o.band) {
      const yb1 = Math.max(m.t, y(o.band[1]));
      const yb0 = Math.min(m.t + ph, y(o.band[0]));
      if (yb0 > yb1) {
        svg += '<rect class="band" x="' + m.l + '" y="' + yb1.toFixed(1) + '" width="' + pw + '" height="' + (yb0 - yb1).toFixed(1) + '"/>';
        if (o.band[2]) svg += '<text class="band-label" x="' + (m.l + pw - 6) + '" y="' + (yb1 + 13).toFixed(1) + '" text-anchor="end">' + esc(o.band[2]) + '</text>';
      }
    }
    // grid + y labels
    ticks.ticks.forEach((v) => {
      const yy = y(v).toFixed(1);
      svg += '<line class="grid" x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + yy + '" y2="' + yy + '"/>';
      svg += '<text class="axis" x="' + (m.l - 8) + '" y="' + yy + '" dy=".32em" text-anchor="end">' + esc(fmtV(v, true)) + '</text>';
    });
    svg += '<line class="baseline" x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + base.toFixed(1) + '" y2="' + base.toFixed(1) + '"/>';
    timeTicks(t0, t1, pw).forEach((tk) => {
      const xx = x(tk.t);
      if (xx < m.l + 10 || xx > m.l + pw - 10) return;
      svg += '<text class="axis" x="' + xx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(tickLabel(tk)) + '</text>';
    });

    // series
    series.forEach((s, i) => {
      if (o.showRange && series.length === 1 && s.mn) svg += '<path class="range" d="' + bandPath(s.t, s.mn, s.mx, x, y) + '" fill="' + s.color + '"/>';
      if (o.area !== false && series.length === 1) svg += '<path d="' + areaPath(s.t, s.v, x, y, base) + '" fill="url(#' + id + 'g' + i + ')"/>';
    });
    series.forEach((s) => {
      svg += '<path class="line' + (s.dashed ? ' dashed' : '') + '" d="' + linePath(s.t, s.v, x, y) + '" stroke="' + s.color + '"/>';
    });
    // end markers
    series.forEach((s) => {
      for (let i = s.v.length - 1; i >= 0; i--) {
        if (s.v[i] != null) { svg += '<circle class="dot" cx="' + x(s.t[i]).toFixed(1) + '" cy="' + y(s.v[i]).toFixed(1) + '" r="4" fill="' + s.color + '"/>'; break; }
      }
    });
    // hover layer
    svg += '<line class="cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ph) + '" style="display:none"/>';
    series.forEach((s, i) => (svg += '<circle class="hdot" data-i="' + i + '" r="4.5" fill="' + s.color + '" style="display:none"/>'));
    svg += '<rect class="hit" x="' + m.l + '" y="0" width="' + pw + '" height="' + H + '" fill="transparent"/>';
    svg += '</svg>';
    resetPin(el);
    el.innerHTML = svg;

    const tt = tooltip(el);
    const svgEl = el.querySelector('svg');
    const cross = svgEl.querySelector('.cross');
    const dots = svgEl.querySelectorAll('.hdot');
    const ref = series.reduce((a, s) => (s.t.length > a.t.length ? s : a), series[0]);
    const hit = svgEl.querySelector('.hit');
    const move = (ev) => {
      const rect = svgEl.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const target = t0 + ((px - m.l) / pw) * (t1 - t0);
      const ri = nearest(ref.t, target);
      if (ri < 0) return false;
      const tt0 = ref.t[ri];
      const cx = x(tt0);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.style.display = '';
      let rows = '';
      let anyY = null;
      series.forEach((s, i) => {
        const k = nearest(s.t, tt0);
        const v = k >= 0 && Math.abs(s.t[k] - tt0) <= (t1 - t0) / 40 + HOUR ? s.v[k] : null;
        const dot = dots[i];
        if (v == null) { dot.style.display = 'none'; }
        else {
          dot.setAttribute('cx', cx);
          dot.setAttribute('cy', y(v));
          dot.style.display = '';
          if (anyY == null) anyY = y(v);
        }
        let extra = '';
        if (o.showRange && series.length === 1 && s.mn && s.mn[k] != null && s.mx[k] != null && s.mn[k] !== s.mx[k]) extra = ' <span class="muted">(' + esc(fmtV(s.mn[k])) + ' – ' + esc(fmtV(s.mx[k])) + ')</span>';
        rows += '<div class="tt-row"><span class="sw' + (s.dashed ? ' dashed' : '') + '" style="--c:' + s.color + '"></span><span class="tt-name">' + esc(s.name) + '</span><b>' + esc(v == null ? '–' : fmtV(v)) + '</b>' + extra + '</div>';
      });
      const active = (o.segments || []).filter((sg) => sg.from <= tt0 && sg.to >= tt0).map((sg) => sg.label);
      const uniq = active.filter((a, i2) => active.indexOf(a) === i2);
      if (uniq.length) rows += '<div class="tt-note">' + uniq.map(esc).join(' · ') + '</div>';
      tt.innerHTML = '<div class="tt-time">' + esc(CP.fmt.dateTime(new Date(tt0), (t1 - t0) > 2 * DAY)) + '</div>' + rows;
      placeTooltip(el, tt, cx, anyY == null ? H / 2 : anyY);
    };
    const leave = () => {
      tt.style.display = 'none';
      cross.style.display = 'none';
      dots.forEach((d) => (d.style.display = 'none'));
    };
    interact(el, hit, move, leave);
  }

  /* ------------------------------------------------------------------ */
  /* Sparkline (string)                                                  */
  /* ------------------------------------------------------------------ */
  function sparkline(ts, vs, color, opts) {
    opts = opts || {};
    const W = 200;
    const H = opts.height || 40;
    if (!ts || !vs || vs.filter((v) => v != null).length < 2) return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"></svg>';
    let lo = Infinity;
    let hi = -Infinity;
    vs.forEach((v) => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (hi - lo < (opts.minSpan || 1)) { const mid = (hi + lo) / 2; lo = mid - (opts.minSpan || 1) / 2; hi = mid + (opts.minSpan || 1) / 2; }
    const t0 = ts[0];
    const t1 = ts[ts.length - 1];
    const x = (tt) => ((tt - t0) / (t1 - t0 || 1)) * W;
    const y = (v) => 3 + (1 - (v - lo) / (hi - lo)) * (H - 6);
    const id = 's' + ++uid;
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".30"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + areaPath(ts, vs, x, y, H) + '" fill="url(#' + id + ')"/>' +
      '<path d="' + linePath(ts, vs, x, y) + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Ring gauge (string)                                                 */
  /* ------------------------------------------------------------------ */
  function ring(score, opts) {
    opts = opts || {};
    const size = opts.size || 64;
    const sw = opts.stroke || 7;
    const r = (size - sw) / 2;
    const c = 2 * Math.PI * r;
    const f = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
    const color = score == null ? 'var(--muted)' : CP.climate.scales.score(score);
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(score == null ? '–' : score + '/100') + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-track" stroke-width="' + sw + '" fill="none"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke="' + color + '" stroke-width="' + sw + '" fill="none" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(2) + ' ' + c.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      (opts.text === false ? '' : '<text x="50%" y="50%" dy=".35em" text-anchor="middle" class="ring-text" style="font-size:' + Math.round(size * (opts.fontScale || 0.3)) + 'px">' + (score == null ? '–' : score) + '</text>') +
      '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Heatmap (hour × day grid)                                           */
  /* ------------------------------------------------------------------ */
  /** opts: { rows:[{label, date, cells:[{v,t}] x24}], color(v), format(v), legend:{min,max} } */
  function heatmap(el, o) {
    el.classList.add('chart');
    let html = '<div class="hm" role="grid">';
    html += '<div class="hm-corner"></div>';
    for (let h = 0; h < 24; h++) html += '<div class="hm-hour">' + (h % 3 === 0 ? String(h).padStart(2, '0') : '') + '</div>';
    o.rows.forEach((row, ri) => {
      html += '<div class="hm-label">' + esc(row.label) + '</div>';
      row.cells.forEach((cell, ci) => {
        const bg = cell.v == null ? 'var(--empty-cell)' : o.color(cell.v);
        html += '<div class="hm-cell" data-r="' + ri + '" data-c="' + ci + '" style="background:' + bg + '"></div>';
      });
    });
    html += '</div>';
    if (o.legend) {
      const stops = [];
      for (let i = 0; i <= 10; i++) stops.push(o.color(o.legend.min + ((o.legend.max - o.legend.min) * i) / 10) + ' ' + i * 10 + '%');
      html += '<div class="hm-legend"><span>' + esc(o.format(o.legend.min)) + '</span><div class="hm-ramp" style="background:linear-gradient(90deg,' + stops.join(',') + ')"></div><span>' + esc(o.format(o.legend.max)) + '</span></div>';
    }
    resetPin(el);
    el.innerHTML = html;
    const tt = tooltip(el);
    const grid = el.querySelector('.hm');
    let active = null;
    const clear = () => {
      tt.style.display = 'none';
      if (active) { active.classList.remove('active'); active = null; }
    };
    const show = (ev) => {
      // during a touch drag the event target stays the first cell; use the finger position
      const hitEl = ev.pointerType === 'mouse' ? ev.target : document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = hitEl && hitEl.closest ? hitEl.closest('.hm-cell') : null;
      if (!cell || !grid.contains(cell)) { clear(); return false; }
      if (active !== cell) { if (active) active.classList.remove('active'); active = cell; cell.classList.add('active'); }
      const row = o.rows[+cell.dataset.r];
      const c = row.cells[+cell.dataset.c];
      const h = String(+cell.dataset.c).padStart(2, '0');
      tt.innerHTML = '<div class="tt-time">' + esc(row.long || row.label) + ' · ' + h + ':00–' + h + ':59</div><div class="tt-row"><b>' + esc(c.v == null ? '–' : o.format(c.v)) + '</b></div>';
      const r = el.getBoundingClientRect();
      const cr = cell.getBoundingClientRect();
      placeTooltip(el, tt, cr.left - r.left + cr.width / 2, cr.top - r.top);
      return true;
    };
    interact(el, grid, show, clear);
  }

  /* ------------------------------------------------------------------ */
  /* Comfort chart (temperature × humidity scatter)                      */
  /* ------------------------------------------------------------------ */
  /** opts: { points:[{name,t,h,color,trail:[[t,h]],extra}], zone:{t0,t1,h0,h1}, fmtT, height } */
  function comfortChart(el, o) {
    el.classList.add('chart');
    mount(el, () => drawComfort(el, o));
  }
  function drawComfort(el, o) {
    const W = Math.max(280, el.clientWidth || 600);
    const H = o.height || 380;
    const m = { l: 48, r: 18, t: 16, b: 40 };
    let tl = o.zone.t0 - 3;
    let th = o.zone.t1 + 3;
    let hl = Math.max(0, o.zone.h0 - 20);
    let hh = Math.min(100, o.zone.h1 + 20);
    o.points.forEach((p) => {
      const all = (p.trail || []).concat([[p.t, p.h]]);
      all.forEach((q) => {
        if (q[0] == null || q[1] == null) return;
        tl = Math.min(tl, q[0] - 0.5); th = Math.max(th, q[0] + 0.5);
        hl = Math.max(0, Math.min(hl, q[1] - 3)); hh = Math.min(100, Math.max(hh, q[1] + 3));
      });
    });
    const tx = niceTicks(tl, th, Math.max(4, Math.round(W / 90)));
    const hy = niceTicks(hl, hh, 6);
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const x = (v) => m.l + ((v - tx.lo) / (tx.hi - tx.lo)) * pw;
    const y = (v) => m.t + (1 - (v - hy.lo) / (hy.hi - hy.lo)) * ph;
    let svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(CP.t('comfort.title')) + '">';
    // zone
    svg += '<rect class="zone" x="' + x(o.zone.t0).toFixed(1) + '" y="' + y(o.zone.h1).toFixed(1) + '" width="' + (x(o.zone.t1) - x(o.zone.t0)).toFixed(1) + '" height="' + (y(o.zone.h0) - y(o.zone.h1)).toFixed(1) + '" rx="10"/>';
    svg += '<text class="band-label" x="' + (x(o.zone.t0) + 8).toFixed(1) + '" y="' + (y(o.zone.h0) - 8).toFixed(1) + '">' + esc(CP.t('comfort_zone')) + '</text>';
    tx.ticks.forEach((v) => {
      svg += '<line class="grid" x1="' + x(v).toFixed(1) + '" x2="' + x(v).toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ph) + '"/>';
      svg += '<text class="axis" x="' + x(v).toFixed(1) + '" y="' + (m.t + ph + 18) + '" text-anchor="middle">' + esc(o.fmtT(v)) + '</text>';
    });
    hy.ticks.forEach((v) => {
      svg += '<line class="grid" x1="' + m.l + '" x2="' + (m.l + pw) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      svg += '<text class="axis" x="' + (m.l - 8) + '" y="' + y(v).toFixed(1) + '" dy=".32em" text-anchor="end">' + v + '%</text>';
    });
    svg += '<text class="axis" x="' + (m.l + pw) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(CP.t('metric.temperature')) + ' →</text>';
    // trails
    o.points.forEach((p) => {
      const tr = (p.trail || []).filter((q) => q[0] != null && q[1] != null);
      if (tr.length > 1) svg += '<polyline class="trail" points="' + tr.map((q) => x(q[0]).toFixed(1) + ',' + y(q[1]).toFixed(1)).join(' ') + '" stroke="' + p.color + '"/>';
    });
    // points + labels: try a few candidate positions and keep the first one without collisions
    const pts = o.points.filter((p) => p.t != null && p.h != null).map((p) => ({ p, cx: x(p.t), cy: y(p.h), i: o.points.indexOf(p) }));
    const boxes = pts.map((q) => ({ x0: q.cx - 8, x1: q.cx + 8, y0: q.cy - 8, y1: q.cy + 8 }));
    const overlaps = (b) => boxes.some((c) => b.x0 < c.x1 && b.x1 > c.x0 && b.y0 < c.y1 && b.y1 > c.y0);
    let labels = '';
    pts.forEach((q) => {
      svg += '<circle class="pt" data-i="' + q.i + '" cx="' + q.cx.toFixed(1) + '" cy="' + q.cy.toFixed(1) + '" r="7" fill="' + q.p.color + '"/>';
      const w = q.p.name.length * 6.6 + 4;
      const cands = [[12, 4, 'start'], [-12, 4, 'end'], [0, -14, 'middle'], [0, 22, 'middle'], [12, -12, 'start'], [-12, -12, 'end'], [12, 18, 'start'], [-12, 18, 'end']];
      let chosen = null;
      for (let k = 0; k < cands.length && !chosen; k++) {
        const [dx, dy, anchor] = cands[k];
        const lx = q.cx + dx;
        const x0 = anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2;
        const box = { x0, x1: x0 + w, y0: q.cy + dy - 11, y1: q.cy + dy + 3 };
        if (box.x0 < m.l || box.x1 > m.l + pw || box.y0 < m.t) continue;
        if (!overlaps(box)) chosen = { lx, ly: q.cy + dy, anchor, box };
      }
      if (!chosen) chosen = { lx: q.cx + 12, ly: q.cy + 4, anchor: 'start', box: { x0: q.cx + 12, x1: q.cx + 12 + w, y0: q.cy - 7, y1: q.cy + 7 } };
      boxes.push(chosen.box);
      labels += '<text class="pt-label" x="' + chosen.lx.toFixed(1) + '" y="' + chosen.ly.toFixed(1) + '" text-anchor="' + chosen.anchor + '">' + esc(q.p.name) + '</text>';
    });
    svg += labels;
    svg += '</svg>';
    resetPin(el);
    el.innerHTML = svg;
    const tt = tooltip(el);
    const svgEl = el.querySelector('svg');
    let active = null;
    const clear = () => {
      tt.style.display = 'none';
      if (active) { active.classList.remove('active'); active = null; }
    };
    // nearest room point within reach of the pointer (generous for fingers)
    const show = (ev) => {
      const rect = svgEl.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const reach = ev.pointerType === 'mouse' ? 12 : 26;
      let best = null;
      pts.forEach((q) => {
        const d = Math.hypot(q.cx - px, q.cy - py);
        if (d <= reach && (!best || d < best.d)) best = { q, d };
      });
      if (!best) { clear(); return false; }
      const c = svgEl.querySelector('.pt[data-i="' + best.q.i + '"]');
      if (active !== c) { if (active) active.classList.remove('active'); active = c; if (c) c.classList.add('active'); }
      const p = best.q.p;
      tt.innerHTML = '<div class="tt-time">' + esc(p.name) + '</div>' + (p.extra || []).map((r) => '<div class="tt-row"><span class="tt-name">' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('');
      placeTooltip(el, tt, best.q.cx, best.q.cy);
      return true;
    };
    interact(el, svgEl, show, clear);
  }

  /* ------------------------------------------------------------------ */
  /* Sun arc (string)                                                    */
  /* ------------------------------------------------------------------ */
  function sunArc(sun) {
    const W = 220;
    const H = 84;
    if (!sun || !sun.nextRising || !sun.nextSetting) return '';
    let rise = sun.nextRising.getTime();
    let set = sun.nextSetting.getTime();
    const now = Date.now();
    if (sun.up) rise -= DAY; // currently between today's rise and set
    if (!sun.up && set < rise) { /* evening: next set is tomorrow */ set -= DAY; rise -= DAY; }
    let f = (now - rise) / (set - rise);
    const up = f >= 0 && f <= 1;
    f = Math.max(0, Math.min(1, f));
    const cx = 20 + f * (W - 40);
    const r = (W - 40) / 2;
    const cy = H - 14 - Math.sin(f * Math.PI) * (H - 28);
    return '<svg class="sunarc" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<path d="M20,' + (H - 14) + ' A' + r + ',' + (H - 28) + ' 0 0 1 ' + (W - 20) + ',' + (H - 14) + '" class="arc"/>' +
      '<line x1="8" x2="' + (W - 8) + '" y1="' + (H - 14) + '" y2="' + (H - 14) + '" class="horizon"/>' +
      (up ? '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="8" class="sun-dot"/>' : '<circle cx="' + (W / 2) + '" cy="' + (H - 4) + '" r="6" class="moon-dot"/>') +
      '</svg>';
  }

  CP.charts = { lineChart, sparkline, ring, heatmap, comfortChart, sunArc, niceTicks, nearest, HOUR, DAY };
})();
