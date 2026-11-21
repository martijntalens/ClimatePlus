/* ClimatePlus — application shell and views */
(function () {
  'use strict';
  const CP = window.CP;
  const t = (k, v) => CP.t(k, v);
  const C = CP.climate;
  const F = CP.fmt;
  const esc = CP.esc;
  const H = CP.charts.HOUR;
  const DAY = CP.charts.DAY;

  /* ------------------------------------------------------------------ */
  /* Palette & icons                                                     */
  /* ------------------------------------------------------------------ */
  const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
  const OTHER = '#898781';
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const slotColor = (slot) => (slot == null || slot >= 8 ? OTHER : (isDark() ? SERIES_DARK : SERIES_LIGHT)[slot]);
  const outdoorColor = () => (isDark() ? '#c3c2b7' : '#52514e');
  const HEAT_SEG = 'rgba(236,131,90,.16)';
  const WINDOW_SEG = 'rgba(42,120,214,.13)';

  const ICONS = {
    thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
    drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    wind: '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    snow: '<path d="M12 2v20M4.93 7l14.14 10M4.93 17L19.07 7M9 4l3 3 3-3M9 20l3-3 3 3"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    battery: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2M6 10v4"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
    home: '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7s3 4-2 7M14 12c4 0 7 1 7 4s-4 3-7-2M12 14c0 4-1 7-4 7s-3-4 2-7M10 12c-4 0-7-1-7-4s4-3 7 2"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    cloudsun: '<path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65A4 4 0 0 0 8.3 10.3"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6z"/>',
    rain: '<path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/>',
    spore: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="9" r="3"/><circle cx="9.5" cy="16" r="3"/><circle cx="17.5" cy="17" r="1.5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"/>',
    sound: '<path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    up: '<path d="M7 17L17 7M9 7h8v8"/>',
    down: '<path d="M7 7l10 10M17 9v8H9"/>',
    flat: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"/>'
  };
  const icon = (name, cls) => '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>';
  CP.icon = icon;

  const WX = { 'clear-night': 'moon', sunny: 'sun', partlycloudy: 'cloudsun', cloudy: 'cloud', fog: 'cloud', rainy: 'rain', pouring: 'rain', 'lightning-rainy': 'rain', lightning: 'rain', snowy: 'snow', 'snowy-rainy': 'snow', hail: 'snow', windy: 'wind', 'windy-variant': 'wind', exceptional: 'alert' };
  const WX_LABEL = {
    nl: { 'clear-night': 'Helder', sunny: 'Zonnig', partlycloudy: 'Half bewolkt', cloudy: 'Bewolkt', fog: 'Mist', rainy: 'Regen', pouring: 'Zware regen', 'lightning-rainy': 'Onweer', lightning: 'Onweer', snowy: 'Sneeuw', 'snowy-rainy': 'Natte sneeuw', hail: 'Hagel', windy: 'Winderig', 'windy-variant': 'Winderig', exceptional: 'Uitzonderlijk' },
    en: { 'clear-night': 'Clear', sunny: 'Sunny', partlycloudy: 'Partly cloudy', cloudy: 'Cloudy', fog: 'Fog', rainy: 'Rain', pouring: 'Heavy rain', 'lightning-rainy': 'Thunderstorm', lightning: 'Lightning', snowy: 'Snow', 'snowy-rainy': 'Sleet', hail: 'Hail', windy: 'Windy', 'windy-variant': 'Windy', exceptional: 'Exceptional' }
  };

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  const store = {
    get(k) { try { return localStorage.getItem('climateplus.' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('climateplus.' + k, v); } catch (e) { /* ignore */ } }
  };
  const S = {
    boot: null,
    model: null,
    ev: null,
    spark: null,
    sparkAt: 0,
    forecast: null,
    forecastAt: 0,
    connected: false,
    lastUpdate: null,
    error: null,
    route: { view: 'overview' },
    trends: { metric: 'temperature', range: '24h', hidden: new Set() },
    heat: { entity: null, days: 14 },
    room: { range: '24h' },
    sensors: { q: '', filter: 'all' },
    settings: { q: '', filter: 'all', catalog: null, draft: null, saving: false, message: null },
    cache: {},
    dirty: false,
    lastChartTouch: 0,
    lastHtml: null,
    theme: store.get('theme') || 'auto'
  };
  const RANGES = {
    '24h': { hours: 24, points: 288 },
    '48h': { hours: 48, points: 288 },
    '7d': { hours: 168, points: 336 },
    '30d': { hours: 720, points: 720 },
    '1y': { hours: 8760, points: 365 }
  };
  const main = () => document.getElementById('main');

  /* ------------------------------------------------------------------ */
  /* Unit helpers                                                        */
  /* ------------------------------------------------------------------ */
  function unitOfId(id) {
    const eid = id.split('|')[0];
    const st = S.model.states[eid];
    const a = (st && st.attributes) || {};
    if (eid.startsWith('weather.')) return a.temperature_unit || S.model.tempUnit;
    if (eid.startsWith('climate.')) return S.model.tempUnit;
    return a.unit_of_measurement;
  }
  const disp = (metric, v) => (v == null ? null : metric === 'temperature' ? F.toDisplayTemp(v, S.model) : v);
  function fmtDisp(metric, v) {
    if (v == null) return '–';
    const m = C.METRICS[metric] || { dec: 1 };
    const u = F.unit(metric, S.model);
    return F.num(v, m.dec) + (u ? (u === '%' || u.charAt(0) === '°' ? u : ' ' + u) : '');
  }
  function seriesDisplay(id, metric, raw) {
    if (!raw || !raw.t) return null;
    const u = unitOfId(id);
    const conv = (v) => (v == null ? null : disp(metric, C.normalise(metric, v, u)));
    return { t: raw.t, v: raw.v.map(conv), mn: raw.mn ? raw.mn.map(conv) : null, mx: raw.mx ? raw.mx.map(conv) : null, seg: raw.seg, source: raw.source };
  }
  function metricOfId(id) {
    const eid = id.split('|')[0];
    const e = S.model.entities[eid];
    if (e && e.metric) return e.metric;
    if (id.indexOf('current_humidity') >= 0) return 'humidity';
    return 'temperature';
  }
  function lastValue(s) {
    if (!s) return null;
    for (let i = s.v.length - 1; i >= 0; i--) if (s.v[i] != null) return { v: s.v[i], i };
    return null;
  }
  /** change per hour over the last hour of a series */
  function trendOf(s) {
    const last = lastValue(s);
    if (!last) return null;
    const target = s.t[last.i] - H;
    const k = CP.charts.nearest(s.t, target);
    if (k < 0 || s.v[k] == null || k === last.i) return null;
    const hours = (s.t[last.i] - s.t[k]) / H;
    return hours > 0.25 ? (last.v - s.v[k]) / hours : null;
  }
  function trendHtml(s, metric, threshold) {
    const r = trendOf(s);
    if (r == null) return '';
    const dir = Math.abs(r) < threshold ? 'flat' : r > 0 ? 'up' : 'down';
    const label = dir === 'flat' ? t('trend.stable') : t(dir === 'up' ? 'trend.rising' : 'trend.falling', { v: fmtDisp(metric, Math.abs(r)) });
    return '<span class="trend trend-' + dir + '" title="' + esc(label) + '">' + icon(dir) + (dir === 'flat' ? '' : '<span>' + esc(F.num(Math.abs(r), metric === 'temperature' ? 1 : 0)) + '/' + (CP.i18n.lang === 'nl' ? 'u' : 'h') + '</span>') + '</span>';
  }
  function outdoorTempId() {
    const m = S.model;
    if (m.opts.outdoor_temperature_entity && m.states[m.opts.outdoor_temperature_entity]) return m.opts.outdoor_temperature_entity;
    const r = m.outdoorRooms.find((x) => x.primary.temperature);
    if (r) return r.primary.temperature;
    return m.weather ? m.weather + '|temperature' : null;
  }
  function outdoorHumidityId() {
    const m = S.model;
    if (m.opts.outdoor_humidity_entity && m.states[m.opts.outdoor_humidity_entity]) return m.opts.outdoor_humidity_entity;
    const r = m.outdoorRooms.find((x) => x.primary.humidity);
    if (r) return r.primary.humidity;
    return m.weather ? m.weather + '|humidity' : null;
  }
  function floorName(r) {
    const f = S.model.floors[r.floorId];
    return f ? f.name : '';
  }

  /* ------------------------------------------------------------------ */
  /* Theme                                                               */
  /* ------------------------------------------------------------------ */
  function cssColorLuminance(color) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = '#010203';
      ctx.fillStyle = color;
      const hex = ctx.fillStyle;
      if (hex === '#010203' || hex.charAt(0) !== '#') return null;
      const n = parseInt(hex.slice(1), 16);
      return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    } catch (e) { return null; }
  }
  function haPrefersDark() {
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        const doc = window.parent.document;
        let bg = getComputedStyle(doc.documentElement).getPropertyValue('--primary-background-color').trim();
        if (!bg) bg = getComputedStyle(doc.body).backgroundColor;
        const lum = bg ? cssColorLuminance(bg) : null;
        if (lum != null) return lum < 0.45;
      }
    } catch (e) { /* cross-origin */ }
    return null;
  }
  function applyTheme() {
    let mode = S.theme;
    if (mode === 'auto') {
      const ha = haPrefersDark();
      mode = ha != null ? (ha ? 'dark' : 'light') : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const changed = document.documentElement.dataset.theme !== mode;
    document.documentElement.dataset.theme = mode;
    const btn = document.getElementById('theme-btn');
    if (btn) btn.title = t('theme.' + S.theme);
    return changed;
  }

  /* ------------------------------------------------------------------ */
  /* Shell                                                               */
  /* ------------------------------------------------------------------ */
  const NAV = [
    ['overview', 'home'],
    ['trends', 'chart'],
    ['heatmap', 'grid'],
    ['comfort', 'gauge'],
    ['sensors', 'list']
  ];
  function renderShell() {
    const loc = S.boot && S.boot.config && S.boot.config.location_name;
    document.getElementById('app').innerHTML =
      '<header class="top">' +
      '<a class="brand" href="#/overview"><span class="logo">' + logoSvg() + '</span><span><span class="brand-name">ClimatePlus</span><span class="brand-sub">' + esc(loc || 'Home Assistant') + '</span></span></a>' +
      '<nav class="tabs" aria-label="ClimatePlus">' + NAV.map(([v, ic]) => '<a href="#/' + v + '" data-view="' + v + '">' + icon(ic) + '<span>' + esc(t('nav.' + v)) + '</span></a>').join('') + '</nav>' +
      '<div class="top-right"><span id="status" class="pill"></span><a id="settings-btn" class="icon-btn" href="#/settings" title="' + esc(t('nav.settings')) + '" aria-label="' + esc(t('nav.settings')) + '">' + icon('settings') + '</a><button id="theme-btn" class="icon-btn" type="button">' + icon('contrast') + '</button></div>' +
      '</header>' +
      '<div id="banner"></div>' +
      '<main id="main" tabindex="-1"><div class="loading"><div class="spinner"></div>' + esc(t('loading')) + '</div></main>' +
      '<footer class="foot">' + esc(t('footer', { v: (S.boot && S.boot.version) || '' })) + '</footer>';
    document.getElementById('theme-btn').addEventListener('click', () => {
      S.theme = S.theme === 'auto' ? 'light' : S.theme === 'light' ? 'dark' : 'auto';
      store.set('theme', S.theme);
      applyTheme();
      renderView();
    });
    applyTheme();
    updateStatus();
    markNav();
  }
  function logoSvg() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3987e5"/><stop offset="1" stop-color="#1baf7a"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#lg)"/><path d="M16 6.5l9 7.2V25a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V13.7z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M17.6 18.2v-5a1.6 1.6 0 0 0-3.2 0v5a2.8 2.8 0 1 0 3.2 0z" fill="#fff"/></svg>';
  }
  function markNav() {
    const v = S.route.view === 'room' ? 'overview' : S.route.view;
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
    const gear = document.getElementById('settings-btn');
    if (gear) gear.classList.toggle('active', v === 'settings');
  }
  function updateStatus() {
    const el = document.getElementById('status');
    if (!el) return;
    const demo = CP.api.demo;
    const live = demo || S.connected;
    el.className = 'pill ' + (demo ? 'pill-demo' : live ? 'pill-live' : 'pill-off');
    el.innerHTML = '<span class="dot"></span>' + esc(demo ? t('status.demo') : live ? t('status.live') : t('status.offline')) +
      (S.lastUpdate ? '<span class="pill-time">' + esc(t('updated', { time: F.time(new Date(S.lastUpdate)) })) + '</span>' : '');
    const banner = document.getElementById('banner');
    if (banner) banner.innerHTML = demo ? '<div class="banner">' + icon('info') + esc(t('demo.banner')) + '</div>' : '';
  }

  /* ------------------------------------------------------------------ */
  /* Data loading                                                        */
  /* ------------------------------------------------------------------ */
  async function load() {
    const boot = await CP.api.bootstrap();
    const reload = !!S.model;
    const scrollY = window.scrollY;
    S.boot = boot;
    CP.i18n.setLanguage((boot.options || {}).language, (boot.config || {}).language);
    S.model = C.buildModel(boot);
    S.ev = C.evaluate(S.model);
    S.connected = boot.connected !== false;
    S.lastUpdate = Date.now();
    S.error = null;
    S.cache = {};
    // On a reload keep the sparklines and forecast on screen while they refresh
    // in the background, so the page does not collapse and jump.
    if (!reload) S.spark = null;
    S.lastHtml = null;
    renderShell();
    route();
    if (reload) window.scrollTo(0, scrollY);
    loadSpark();
    loadForecast();
  }
  let retryTimer = null;
  async function start() {
    try {
      await load();
      if (!S.socket) S.socket = CP.api.connect(onMessage);
    } catch (err) {
      S.error = err;
      if (!document.querySelector('.top')) renderShell();
      main().innerHTML = '<div class="card error-card">' + icon('alert', 'big') + '<h2>' + esc(t('error.title')) + '</h2><p>' + esc(t('error.text')) + '</p><p class="muted small">' + esc(err.message) + '</p><button class="btn" id="retry">' + esc(t('error.retry')) + '</button></div>';
      document.getElementById('retry').onclick = () => { clearTimeout(retryTimer); start(); };
      clearTimeout(retryTimer);
      retryTimer = setTimeout(start, 5000);
    }
  }
  async function loadSpark() {
    const m = S.model;
    const ids = [];
    m.roomList.forEach((r) => ['temperature', 'humidity', 'co2'].forEach((k) => r.primary[k] && ids.push(r.primary[k])));
    const ot = outdoorTempId();
    const oh = outdoorHumidityId();
    if (ot) ids.push(ot);
    if (oh) ids.push(oh);
    if (!ids.length) return;
    try {
      const first = !S.spark;
      S.spark = await CP.api.series(ids, { hours: 24, points: 96 });
      S.sparkAt = Date.now();
      // first load: draw now; refreshes go through the live tick (which waits while a chart is in use)
      if (first && ['overview', 'comfort'].indexOf(S.route.view) >= 0) renderView();
      else S.dirty = true;
    } catch (e) {
      console.warn('ClimatePlus: sparkline load failed', e);
    }
  }
  function spark(id) {
    if (!S.spark || !id) return null;
    return seriesDisplay(id, metricOfId(id), S.spark.series[id]);
  }
  async function loadForecast() {
    if (!S.model.weather) return;
    try {
      const first = !S.forecast;
      const res = await CP.api.forecast(S.model.weather, 'daily');
      S.forecast = res.forecast || [];
      S.forecastAt = Date.now();
      if (first && S.route.view === 'overview') renderView();
      else S.dirty = true;
    } catch (e) { S.forecast = []; }
  }
  async function cached(key, ttl, fn) {
    const hit = S.cache[key];
    if (hit && Date.now() - hit.at < ttl) return hit.data;
    const data = await fn();
    S.cache[key] = { at: Date.now(), data };
    return data;
  }

  /* ------------------------------------------------------------------ */
  /* Live updates                                                        */
  /* ------------------------------------------------------------------ */
  let reloadTimer = null;
  function onMessage(msg) {
    if (msg.type === 'state' && S.model) {
      if (msg.state) S.model.states[msg.entity_id] = msg.state;
      S.lastUpdate = Date.now();
      S.dirty = true;
    } else if (msg.type === 'reload') {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { if (S.model) load().catch(() => {}); else start(); }, 800);
    } else if (msg.type === 'status') {
      S.connected = !!msg.connected;
      updateStatus();
    }
  }
  function tick() {
    if (applyTheme()) renderView();
    if (!S.model) return;
    if (Date.now() - S.sparkAt > 5 * 60000) loadSpark();
    if (S.model.weather && Date.now() - S.forecastAt > 30 * 60000) loadForecast();
    updateStatus();
    if (!S.dirty) return;
    const view = S.route.view;
    // Never redraw under the user's hand: wait while a chart tooltip is open,
    // the pointer is on a chart, or a chart was touched in the last 15 seconds.
    if (document.querySelector('.chart:hover, .tt[style*="block"]') || Date.now() - S.lastChartTouch < 15000) return;
    S.ev = C.evaluate(S.model);
    S.dirty = false;
    if (view === 'sensors') renderSensorRows();
    else if (view === 'overview' || view === 'comfort' || view === 'room') renderView(true);
  }

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */
  function route() {
    const parts = (location.hash || '#/overview').replace(/^#\/?/, '').split('/');
    const view = ['overview', 'trends', 'heatmap', 'comfort', 'sensors', 'room', 'settings'].indexOf(parts[0]) >= 0 ? parts[0] : 'overview';
    const prev = S.route.view + (S.route.id || '');
    S.route = { view, id: parts[1] ? decodeURIComponent(parts[1]) : null };
    if (view === 'settings' && prev.indexOf('settings') !== 0) {
      S.settings.filter = S.route.id === 'unassigned' ? 'unassigned' : S.route.id === 'hidden' ? 'hidden' : 'all';
      S.settings.catalog = null;
      S.settings.draft = null;
      S.settings.message = null;
    }
    markNav();
    renderView();
    if (prev !== S.route.view + (S.route.id || '')) window.scrollTo(0, 0);
  }
  function renderView(live) {
    if (!S.model) return;
    const v = S.route.view;
    if (v === 'overview') viewOverview(live);
    else if (v === 'trends') viewTrends(live);
    else if (v === 'heatmap') viewHeatmap();
    else if (v === 'comfort') viewComfort();
    else if (v === 'sensors') viewSensors();
    else if (v === 'room') viewRoom(live);
    else if (v === 'settings') viewSettings();
  }

  /* ------------------------------------------------------------------ */
  /* Shared fragments                                                    */
  /* ------------------------------------------------------------------ */
  const card = (cls, inner) => '<section class="card ' + (cls || '') + '">' + inner + '</section>';
  const cardHead = (title, extra) => '<div class="card-head"><h2>' + esc(title) + '</h2>' + (extra || '') + '</div>';
  function chips(name, options, active) {
    return '<div class="chips" role="group" data-chips="' + name + '">' + options.map(([val, label, ic]) => '<button type="button" class="chip' + (val === active ? ' active' : '') + '" data-val="' + esc(val) + '" aria-pressed="' + (val === active) + '">' + (ic ? icon(ic) : '') + esc(label) + '</button>').join('') + '</div>';
  }
  function onChips(root, name, fn) {
    const el = root.querySelector('[data-chips="' + name + '"]');
    if (el) el.addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) fn(b.dataset.val); });
  }
  function statusTag(level, label) {
    const ic = { good: 'check', warning: 'alert', critical: 'alert', info: 'info', na: 'info' }[level] || 'info';
    return '<span class="tag tag-' + level + '">' + icon(ic) + esc(label) + '</span>';
  }
  function scoreTag(score) {
    const l = C.scoreLabel(score);
    return statusTag(l.level, l.label);
  }
  function co2Level(v) {
    const o = S.model.opts;
    if (v == null) return 'na';
    return v >= o.co2_critical ? 'critical' : v >= o.co2_warning ? 'warning' : 'good';
  }
  function loadingBox(h) { return '<div class="loading" style="min-height:' + (h || 200) + 'px"><div class="spinner"></div></div>'; }
  function legendHtml(series, toggle) {
    return '<div class="legend">' + series.map((s, i) => '<button type="button" class="leg' + (s.hidden ? ' off' : '') + '" data-i="' + i + '"' + (toggle ? '' : ' disabled') + '><span class="sw' + (s.dashed ? ' dashed' : '') + '" style="--c:' + s.color + '"></span>' + esc(s.name) + '</button>').join('') + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Overview                                                            */
  /* ------------------------------------------------------------------ */
  function viewOverview(live) {
    const m = S.model;
    const ev = S.ev;
    const h = ev.house;
    const o = m.opts;
    if (!ev.rooms.length) {
      main().innerHTML = card('', '<div class="empty-state">' + icon('home', 'big') + '<h2>' + esc(t('rooms')) + '</h2><p>' + esc(t(ev.unassigned ? 'rooms.none_assigned' : 'room.no_sensors')) + '</p></div>') + (ev.unassigned ? unassignedCard(ev.unassigned) : '');
      return;
    }
    // indoor average series from sparklines
    const roomTemps = m.roomList.map((r) => spark(r.primary.temperature)).filter(Boolean);
    const avgSeries = averageSeries(roomTemps);
    const roomHums = m.roomList.map((r) => spark(r.primary.humidity)).filter(Boolean);
    const avgHum = averageSeries(roomHums);
    const outT = spark(outdoorTempId());

    let html = '<div class="hero">';
    // score
    const parts = ['temperature', 'humidity', 'air'].map((k) => {
      const vals = ev.rooms.map((x) => x.parts[k]).filter((v) => v != null);
      return [k, vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null];
    }).filter((p) => p[1] != null);
    html += card('hero-score', '<div class="hero-label">' + esc(t('hero.score')) + '</div><div class="score-wrap">' + CP.charts.ring(h.score, { size: 104, stroke: 10 }) +
      '<div class="score-side">' + scoreTag(h.score) + '<div class="muted small">' + esc(t('hero.score_sub', { n: h.scoredRooms })) + '</div></div></div>' +
      '<div class="score-parts">' + parts.map(([k, v]) => '<div class="mini-bar"><span>' + esc(t('score.part.' + k)) + '</span><div class="mb-track"><div class="mb-fill" style="width:' + v + '%;background:' + C.scales.score(v) + '"></div></div><b>' + v + '</b></div>').join('') + '</div>');
    // indoor temperature
    html += card('hero-metric', '<div class="hero-label">' + icon('thermo') + esc(t('hero.indoor')) + '</div><div class="hero-value">' + esc(F.temp(h.temperature, m)) + (avgSeries ? trendHtml(avgSeries, 'temperature', 0.15) : '') + '</div>' +
      '<div class="muted small">' + (h.coldest ? esc(t('hero.range', { min: F.temp(h.coldest.values.temperature, m), max: F.temp(h.warmest.values.temperature, m) })) : '') + '</div>' +
      '<div class="hero-spark">' + (avgSeries ? CP.charts.sparkline(avgSeries.t, avgSeries.v, slotColor(0), { minSpan: 1 }) : '') + '</div>');
    // humidity
    html += card('hero-metric', '<div class="hero-label">' + icon('drop') + esc(t('hero.humidity')) + '</div><div class="hero-value">' + esc(F.metric('humidity', h.humidity, m)) + (avgHum ? trendHtml(avgHum, 'humidity', 1) : '') + '</div>' +
      '<div class="kv-row"><span>' + esc(t('dewpoint')) + ' <b>' + esc(F.temp(h.dew, m)) + '</b></span><span>' + esc(t('abs_humidity')) + ' <b>' + esc(F.num(h.ah, 1)) + ' g/m³</b></span></div>' +
      '<div class="hero-spark">' + (avgHum ? CP.charts.sparkline(avgHum.t, avgHum.v, slotColor(2), { minSpan: 4 }) : '') + '</div>');
    // outdoor
    const out = ev.outdoor;
    const wst = m.weather ? m.states[m.weather] : null;
    let outInner = '<div class="hero-label">' + icon('cloudsun') + esc(t('hero.outdoor')) + '</div>';
    if (out.available) {
      outInner += '<div class="hero-value">' + (out.condition ? '<span class="wx">' + icon(WX[out.condition] || 'cloud') + '</span>' : '') + esc(F.temp(out.temperature, m)) + (outT ? trendHtml(outT, 'temperature', 0.3) : '') + '</div>' +
        '<div class="muted small">' + esc([out.condition ? (WX_LABEL[CP.i18n.lang] || WX_LABEL.en)[out.condition] || out.condition : null, out.apparent != null ? t('feels_like') + ' ' + F.temp(out.apparent, m) : null].filter(Boolean).join(' · ')) + '</div>' +
        '<div class="kv-row"><span>' + icon('drop') + ' <b>' + esc(F.metric('humidity', out.humidity, m)) + '</b></span>' + (out.wind != null ? '<span>' + icon('wind') + ' <b>' + esc(F.num(out.wind, 0) + ' ' + out.windUnit) + '</b></span>' : '') + (out.pressure != null ? '<span>' + icon('gauge') + ' <b>' + esc(F.num(out.pressure, 0)) + ' hPa</b></span>' : '') + '</div>';
      if (S.forecast && S.forecast.length) {
        outInner += '<div class="forecast">' + S.forecast.slice(0, 5).map((f) => {
          const d = new Date(f.datetime);
          const unit = wst && wst.attributes && wst.attributes.temperature_unit;
          const hi = C.normalise('temperature', f.temperature, unit || m.tempUnit);
          const lo = C.normalise('temperature', f.templow, unit || m.tempUnit);
          return '<div class="fc"><span class="fc-day">' + esc(F.date(d, { weekday: 'short' })) + '</span>' + icon(WX[f.condition] || 'cloud') + '<span class="fc-t"><b>' + esc(F.num(F.toDisplayTemp(hi, m), 0)) + '°</b> ' + esc(lo != null ? F.num(F.toDisplayTemp(lo, m), 0) + '°' : '') + '</span></div>';
        }).join('') + '</div>';
      }
    } else outInner += '<p class="muted small">' + esc(t('hero.no_outdoor')) + '</p>';
    html += card('hero-metric hero-outdoor', outInner);
    // air quality
    if (h.worstCO2) {
      const v = h.worstCO2.values.co2;
      const lv = co2Level(v);
      html += card('hero-metric', '<div class="hero-label">' + icon('wind') + esc(t('hero.air')) + '</div><div class="hero-value">' + esc(F.num(v, 0)) + '<small> ppm CO₂</small></div>' +
        '<div class="muted small">' + esc(t('hero.worst_room', { room: h.worstCO2.room.name })) + '</div>' + statusTag(lv, t(lv === 'good' ? 'score.good' : lv === 'warning' ? 'level.warning' : 'score.poor')) +
        '<div class="hero-spark">' + (spark(h.worstCO2.room.primary.co2) ? CP.charts.sparkline(spark(h.worstCO2.room.primary.co2).t, spark(h.worstCO2.room.primary.co2).v, slotColor(6), { minSpan: 200 }) : '') + '</div>');
    }
    // light & sun
    const sun = ev.sun;
    let sunInner = '<div class="hero-label">' + icon('sun') + esc(t('hero.light')) + '</div>';
    if (sun) {
      sunInner += CP.charts.sunArc(sun) + '<div class="kv-row"><span>' + esc(t('sunrise')) + ' <b>' + esc(sun.nextRising ? F.time(sun.nextRising) : '–') + '</b></span><span>' + esc(t('sunset')) + ' <b>' + esc(sun.nextSetting ? F.time(sun.nextSetting) : '–') + '</b></span></div>';
    }
    sunInner += '<div class="kv-row"><span>' + icon('bulb') + ' ' + esc(t('lights_on')) + ' <b>' + h.lightsOn.length + '/' + m.allLights.length + '</b></span>' + (h.lux != null ? '<span>' + esc(t('avg_lux')) + ' <b>' + esc(F.num(h.lux, 0)) + ' lx</b></span>' : '') + '</div>';
    html += card('hero-metric', sunInner);
    html += '</div>';

    // insights + temperature by room
    html += '<div class="grid-2">';
    html += card('insights', cardHead(t('insights'), '<span class="count">' + ev.insights.length + '</span>') + insightsHtml(ev.insights));
    html += card('', cardHead(t('temp_by_room')) + tempBars() + highlightsHtml());
    html += '</div>';

    // rooms by floor
    html += '<h2 class="section-title">' + esc(t('rooms')) + '</h2>';
    const groups = [];
    ev.rooms.forEach((x) => {
      const key = x.room.floorId || '_';
      let g = groups.find((gg) => gg.key === key);
      if (!g) { g = { key, name: x.room.floorId ? floorName(x.room) : (Object.keys(m.floors).length ? t('other_rooms') : ''), rooms: [] }; groups.push(g); }
      g.rooms.push(x);
    });
    groups.forEach((g) => {
      if (g.name && groups.length > 1) html += '<h3 class="floor-title">' + esc(g.name) + '</h3>';
      html += '<div class="rooms">' + g.rooms.map(roomCard).join('') + '</div>';
    });
    if (ev.unassigned) html += unassignedCard(ev.unassigned);

    // indoor vs outdoor
    html += card('', cardHead(t('indoor_vs_outdoor')) + '<div id="io-legend"></div><div id="io-chart" class="chart-box">' + (S.spark ? '' : loadingBox(240)) + '</div>');
    // live update without visible change (e.g. a value that rounds the same): leave the page alone
    const key = 'overview|' + isDark() + '|' + html;
    if (live && S.lastHtml === key && document.getElementById('io-chart')) return;
    S.lastHtml = key;
    main().innerHTML = html;

    main().querySelectorAll('.ins[data-room]').forEach((el) => el.addEventListener('click', () => (location.hash = '#/room/' + encodeURIComponent(el.dataset.room))));
    if (S.spark) {
      const series = [];
      if (avgSeries) series.push(Object.assign({ name: t('indoor_avg'), color: slotColor(0) }, avgSeries));
      if (outT) series.push(Object.assign({ name: t('outdoor'), color: outdoorColor(), dashed: true }, outT));
      document.getElementById('io-legend').innerHTML = series.length > 1 ? legendHtml(series, false) : '';
      CP.charts.lineChart(document.getElementById('io-chart'), {
        series,
        height: 240,
        band: [disp('temperature', o.temperature_comfort_min), disp('temperature', o.temperature_comfort_max), t('comfort_zone')],
        bandInDomain: false,
        format: (v) => fmtDisp('temperature', v)
      });
    }
  }

  function averageSeries(list) {
    if (!list.length) return null;
    const base = list.reduce((a, s) => (s.t.length > a.t.length ? s : a), list[0]);
    const v = base.t.map((tt, i) => {
      const vals = list.map((s) => (s.t[i] === tt ? s.v[i] : null)).filter((x) => x != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    return { t: base.t, v };
  }

  function insightsHtml(list) {
    if (!list.length) return '<div class="ins ins-good">' + '<span class="ins-ic">' + icon('check') + '</span><div><div class="ins-title">' + esc(t('ins.good.t')) + '</div></div></div>';
    return '<div class="ins-list">' + list.map((i) =>
      '<div class="ins ins-' + i.level + (i.roomId ? ' clickable' : '') + '"' + (i.roomId ? ' data-room="' + esc(i.roomId) + '" role="link" tabindex="0"' : '') + '>' +
      '<span class="ins-ic">' + icon(i.icon) + '</span><div><div class="ins-title">' + esc(i.title) + ' <span class="tag tag-' + i.level + ' tag-sm">' + esc(t('level.' + i.level)) + '</span></div><div class="ins-text">' + esc(i.text) + '</div></div></div>').join('') + '</div>';
  }

  function tempBars() {
    const m = S.model;
    const o = m.opts;
    const rows = S.ev.rooms.filter((x) => x.values.temperature != null);
    if (!rows.length) return '<div class="empty">' + esc(t('no_data')) + '</div>';
    const temps = rows.map((x) => x.values.temperature);
    const lo = Math.floor(Math.min(o.temperature_comfort_min - 3, Math.min.apply(null, temps) - 0.5));
    const hi = Math.ceil(Math.max(o.temperature_comfort_max + 3, Math.max.apply(null, temps) + 0.5));
    const pos = (v) => ((v - lo) / (hi - lo)) * 100;
    let html = '<div class="tbars">';
    rows.forEach((x) => {
      const v = x.values.temperature;
      html += '<a class="tbar" href="#/room/' + encodeURIComponent(x.room.id) + '"><span class="tbar-name">' + esc(x.room.name) + '</span><span class="tbar-track"><span class="tbar-zone" style="left:' + pos(o.temperature_comfort_min) + '%;width:' + (pos(o.temperature_comfort_max) - pos(o.temperature_comfort_min)) + '%"></span><span class="tbar-dot" style="left:' + pos(v) + '%;background:' + C.scales.temperature(v, o) + '"></span></span><span class="tbar-val">' + esc(F.temp(v, m)) + '</span></a>';
    });
    html += '<div class="tbar tbar-axis"><span></span><span class="tbar-track axis-only"><span style="left:0">' + esc(F.temp(lo, m, 0)) + '</span><span style="left:' + pos(o.temperature_comfort_min) + '%">' + esc(F.temp(o.temperature_comfort_min, m)) + '</span><span style="left:' + pos(o.temperature_comfort_max) + '%">' + esc(F.temp(o.temperature_comfort_max, m)) + '</span><span style="left:100%">' + esc(F.temp(hi, m, 0)) + '</span></span><span></span></div>';
    return html + '</div>';
  }

  function highlightsHtml() {
    const h = S.ev.house;
    const m = S.model;
    const items = [];
    if (h.warmest) items.push(['flame', t('hl.warmest'), h.warmest.room.name, F.temp(h.warmest.values.temperature, m)]);
    if (h.coldest && h.coldest !== h.warmest) items.push(['snow', t('hl.coldest'), h.coldest.room.name, F.temp(h.coldest.values.temperature, m)]);
    if (h.mostHumid) items.push(['drop', t('hl.humid'), h.mostHumid.room.name, F.metric('humidity', h.mostHumid.values.humidity, m)]);
    if (h.worstCO2) items.push(['wind', t('hl.co2'), h.worstCO2.room.name, F.metric('co2', h.worstCO2.values.co2, m)]);
    if (!items.length) return '';
    return '<h3 class="sub-title">' + esc(t('highlights')) + '</h3><div class="hl">' + items.map((i) => '<div class="hl-item">' + icon(i[0]) + '<div><div class="muted small">' + esc(i[1]) + '</div><div><b>' + esc(i[3]) + '</b> · ' + esc(i[2]) + '</div></div></div>').join('') + '</div>';
  }

  function roomCard(x) {
    const m = S.model;
    const o = m.opts;
    const r = x.room;
    const v = x.values;
    const tSpark = spark(r.primary.temperature);
    const accent = v.temperature != null ? C.scales.temperature(v.temperature, o) : 'var(--border-strong)';
    const chipsHtml = [];
    if (v.humidity != null) chipsHtml.push('<span class="mchip">' + icon('drop') + esc(F.metric('humidity', v.humidity, m)) + '</span>');
    if (v.co2 != null) chipsHtml.push('<span class="mchip"><span class="sdot sdot-' + co2Level(v.co2) + '"></span>' + esc(F.num(v.co2, 0)) + ' ppm</span>');
    if (v.illuminance != null) chipsHtml.push('<span class="mchip">' + icon('sun') + esc(F.num(v.illuminance, 0)) + ' lx</span>');
    if (v.pm25 != null) chipsHtml.push('<span class="mchip">PM2.5 ' + esc(F.num(v.pm25, 0)) + '</span>');
    if (v.voc != null && v.temperature == null) chipsHtml.push('<span class="mchip">VOC ' + esc(F.num(v.voc, 0)) + '</span>');
    const badges = [];
    x.thermostats.forEach((th) => {
      const active = th.action === 'heating' || th.action === 'preheating';
      badges.push('<span class="badge' + (active ? ' badge-heat' : '') + '">' + icon(active ? 'flame' : 'thermo') + esc(active ? t('heating') : th.action === 'cooling' ? t('cooling') : th.mode === 'off' ? t('off') : t('idle')) + (th.target != null ? ' · ' + esc(F.temp(th.target, m)) : '') + '</span>');
    });
    if (x.openOpenings.length) badges.push('<span class="badge badge-open">' + icon('window') + esc(t('n_open', { n: x.openOpenings.length })) + '</span>');
    if (x.lightsOn.length) badges.push('<span class="badge">' + icon('bulb') + esc(t('n_lights', { n: x.lightsOn.length })) + '</span>');
    const fansOn = r.fans.filter((e) => m.states[e] && m.states[e].state === 'on');
    if (fansOn.length) badges.push('<span class="badge">' + icon('fan') + esc(t('on')) + '</span>');
    if (x.mold === 'high') badges.push('<span class="badge badge-warn">' + icon('spore') + esc(t('mold')) + '</span>');
    return '<a class="room-card" href="#/room/' + encodeURIComponent(r.id) + '" style="--rc-accent:' + accent + '">' +
      '<div class="rc-head"><div><div class="rc-name">' + esc(r.name) + '</div><div class="rc-sub">' + esc(C.scoreLabel(x.score).label) + '</div></div>' + CP.charts.ring(x.score, { size: 46, stroke: 5, fontScale: 0.32 }) + '</div>' +
      '<div class="rc-main"><span class="rc-temp">' + (v.temperature != null ? esc(F.num(F.toDisplayTemp(v.temperature, m), 1)) + '<small>' + esc(m.tempUnit) + '</small>' : '–') + '</span>' + (tSpark ? trendHtml(tSpark, 'temperature', 0.15) : '') + '</div>' +
      '<div class="rc-chips">' + chipsHtml.join('') + '</div>' +
      '<div class="rc-spark">' + (tSpark ? CP.charts.sparkline(tSpark.t, tSpark.v, slotColor(r.slot), { minSpan: 1 }) : '') + '</div>' +
      (badges.length ? '<div class="rc-badges">' + badges.join('') + '</div>' : '') +
      '</a>';
  }

  /** Entities without an area: one row per sensor, no averages and no score. */
  function unassignedRows(u, limit) {
    const m = S.model;
    const rows = [];
    u.sensors.forEach((s) => rows.push([C.METRICS[s.metric].icon, s.id, s.device, F.metric(s.metric, s.value, m)]));
    u.thermostats.forEach((th) => rows.push(['thermo', th.id, null, F.temp(th.current, m)]));
    const r = u.room;
    r.openings.forEach((e) => rows.push(['window', e, null, m.states[e] && m.states[e].state === 'on' ? t('open') : t('closed')]));
    r.lights.concat(r.fans, r.humidifiers).forEach((e) => rows.push([e.startsWith('fan.') ? 'fan' : e.startsWith('humidifier.') ? 'drop' : 'bulb', e, null, m.states[e] && m.states[e].state === 'on' ? t('on') : t('off')]));
    const shown = limit ? rows.slice(0, limit) : rows;
    return '<div class="ua-list">' + shown.map(([ic, id, dev, val]) =>
      '<div class="ua-row">' + icon(ic) + '<span class="ua-name"><span>' + esc(C.displayName(m, id)) + '</span><span class="muted small">' + esc(dev || id) + '</span></span><b class="ua-val">' + esc(val) + '</b></div>').join('') + '</div>' +
      (rows.length > shown.length ? '<div class="muted small ua-more">' + esc(t('and_more', { n: rows.length - shown.length })) + '</div>' : '');
  }
  function unassignedCard(u) {
    return card('ua-card', cardHead(t('unassigned'), '<span class="count">' + u.count + '</span>') +
      '<p class="muted small">' + esc(t('unassigned.hint')) + '</p>' + unassignedRows(u, 6) +
      '<div class="ua-actions"><a class="btn btn-ghost" href="#/room/_none">' + icon('chart') + esc(t('unassigned.view')) + '</a><a class="btn btn-ghost" href="#/settings/unassigned">' + icon('eyeoff') + esc(t('unassigned.manage')) + '</a></div>');
  }

  /* ------------------------------------------------------------------ */
  /* Trends                                                              */
  /* ------------------------------------------------------------------ */
  function availableMetrics() {
    const m = S.model;
    const set = new Set();
    m.roomList.concat(m.outdoorRooms).forEach((r) => Object.keys(r.sensors).forEach((k) => set.add(k)));
    if (m.roomList.some((r) => r.primary.temperature)) set.add('temperature');
    return C.METRIC_ORDER.filter((k) => set.has(k));
  }
  function trendSeriesDefs(metric) {
    const m = S.model;
    const defs = [];
    m.roomList.forEach((r) => {
      const id = r.primary[metric] || (r.sensors[metric] ? r.sensors[metric][0] : null);
      if (id) defs.push({ id, name: r.name, color: slotColor(r.slot), key: 'r:' + r.id });
    });
    let outId = null;
    if (metric === 'temperature') outId = outdoorTempId();
    else if (metric === 'humidity') outId = outdoorHumidityId();
    else {
      const r = m.outdoorRooms.find((x) => x.sensors[metric]);
      if (r) outId = r.sensors[metric][0];
    }
    if (outId) defs.push({ id: outId, name: t('outdoor'), color: outdoorColor(), dashed: true, key: 'outdoor' });
    return defs;
  }
  function bandFor(metric) {
    const o = S.model.opts;
    if (metric === 'temperature') return [disp('temperature', o.temperature_comfort_min), disp('temperature', o.temperature_comfort_max), t('comfort_zone')];
    if (metric === 'humidity') return [o.humidity_comfort_min, o.humidity_comfort_max, t('comfort_zone')];
    if (metric === 'co2') return [400, o.co2_warning, t('comfort_zone')];
    return null;
  }

  async function viewTrends(live) {
    if (live) return;
    const metrics = availableMetrics();
    const st = S.trends;
    if (metrics.indexOf(st.metric) < 0) st.metric = metrics[0] || 'temperature';
    const root = main();
    root.innerHTML = card('', cardHead(t('trends.title'), '<button class="btn btn-ghost" id="csv" type="button">' + icon('download') + esc(t('export')) + '</button>') +
      '<div class="controls">' + chips('metric', metrics.map((k) => [k, t('metric.' + k), C.METRICS[k].icon]), st.metric) + chips('range', Object.keys(RANGES).map((k) => [k, t('range.' + k)]), st.range) + '</div>' +
      '<div id="tr-legend"></div><div id="tr-chart" class="chart-box">' + loadingBox(360) + '</div><p class="muted small">' + esc(t('trends.hint')) + (RANGES[st.range].hours > 168 ? ' ' + esc(t('trends.long_hint')) : '') + '</p>') +
      card('', cardHead(t('stats.series')) + '<div id="tr-stats" class="table-wrap"></div>');
    onChips(root, 'metric', (v) => { st.metric = v; viewTrends(); });
    onChips(root, 'range', (v) => { st.range = v; viewTrends(); });
    const defs = trendSeriesDefs(st.metric);
    const range = RANGES[st.range];
    const key = 'tr:' + st.metric + ':' + st.range;
    let data;
    try {
      data = await cached(key, 120000, () => CP.api.series(defs.map((d) => d.id), { hours: range.hours, points: range.points }));
    } catch (e) {
      document.getElementById('tr-chart').innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
      return;
    }
    if (S.route.view !== 'trends' || st.metric + st.range !== key.slice(3).replace(':', '')) return;
    const series = defs.map((d) => Object.assign({}, d, seriesDisplay(d.id, st.metric, data.series[d.id]) || { t: [], v: [] }, { hidden: st.hidden.has(d.key) }));
    const draw = () => {
      const legend = document.getElementById('tr-legend');
      legend.innerHTML = legendHtml(series, true);
      legend.querySelectorAll('.leg').forEach((b) => b.addEventListener('click', () => {
        const s = series[+b.dataset.i];
        s.hidden = !s.hidden;
        if (s.hidden) st.hidden.add(s.key); else st.hidden.delete(s.key);
        draw();
      }));
      CP.charts.lineChart(document.getElementById('tr-chart'), {
        series,
        height: 360,
        start: data.start,
        end: data.end,
        band: bandFor(st.metric),
        bandInDomain: false,
        showRange: true,
        format: (v) => fmtDisp(st.metric, v)
      });
    };
    draw();
    document.getElementById('tr-stats').innerHTML = statsTable(series, st.metric);
    document.getElementById('csv').onclick = () => exportCsv(series, st.metric, st.range);
  }

  function seriesStats(s) {
    const vals = s.v.filter((v) => v != null);
    if (!vals.length) return null;
    const mins = (s.mn || s.v).filter((v) => v != null);
    const maxs = (s.mx || s.v).filter((v) => v != null);
    return {
      now: vals[vals.length - 1],
      min: Math.min.apply(null, mins.length ? mins : vals),
      max: Math.max.apply(null, maxs.length ? maxs : vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      change: vals[vals.length - 1] - vals[0]
    };
  }
  function statsTable(series, metric) {
    const rows = series.map((s) => [s, seriesStats(s)]).filter((r) => r[1]);
    if (!rows.length) return '<div class="empty">' + esc(t('no_data')) + '</div>';
    const f = (v) => fmtDisp(metric, v);
    return '<table class="tbl"><thead><tr><th>' + esc(t('stats.series')) + '</th><th class="num">' + esc(t('stats.now')) + '</th><th class="num">' + esc(t('stats.min')) + '</th><th class="num">' + esc(t('stats.max')) + '</th><th class="num">' + esc(t('stats.avg')) + '</th><th class="num">' + esc(t('stats.change')) + '</th></tr></thead><tbody>' +
      rows.map(([s, x]) => '<tr><td><span class="sw' + (s.dashed ? ' dashed' : '') + '" style="--c:' + s.color + '"></span>' + esc(s.name) + '</td><td class="num"><b>' + esc(f(x.now)) + '</b></td><td class="num">' + esc(f(x.min)) + '</td><td class="num">' + esc(f(x.max)) + '</td><td class="num">' + esc(f(x.avg)) + '</td><td class="num">' + (x.change > 0 ? '+' : '') + esc(f(x.change)) + '</td></tr>').join('') +
      '</tbody></table>';
  }
  function exportCsv(series, metric, range) {
    const visible = series.filter((s) => s.t && s.t.length);
    if (!visible.length) return;
    const base = visible.reduce((a, s) => (s.t.length > a.t.length ? s : a), visible[0]);
    const unit = F.unit(metric, S.model);
    const lines = [['time'].concat(visible.map((s) => '"' + s.name.replace(/"/g, '""') + ' (' + unit + ')"')).join(',')];
    base.t.forEach((tt) => {
      const row = [new Date(tt).toISOString()];
      visible.forEach((s) => {
        const k = CP.charts.nearest(s.t, tt);
        row.push(k >= 0 && Math.abs(s.t[k] - tt) < 60000 && s.v[k] != null ? String(Math.round(s.v[k] * 100) / 100) : '');
      });
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'climateplus-' + metric + '-' + range + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ------------------------------------------------------------------ */
  /* Heatmap                                                             */
  /* ------------------------------------------------------------------ */
  function heatmapOptions() {
    const m = S.model;
    const groups = [];
    m.roomList.concat(m.outdoorRooms, m.unassigned ? [m.unassigned] : []).forEach((r) => {
      const ids = [];
      C.METRIC_ORDER.forEach((k) => (r.sensors[k] || []).forEach((e) => ids.push(e)));
      if (!r.sensors.temperature && r.primary.temperature) ids.unshift(r.primary.temperature);
      if (ids.length) groups.push({ room: r, ids });
    });
    return groups;
  }
  async function viewHeatmap() {
    const st = S.heat;
    const groups = heatmapOptions();
    const allIds = [].concat.apply([], groups.map((g) => g.ids));
    if (!st.entity || allIds.indexOf(st.entity) < 0) {
      // default: the best-equipped indoor room (usually the living room)
      const best = S.model.roomList.filter((r) => r.primary.temperature).sort((a, b) => Object.keys(b.sensors).length - Object.keys(a.sensors).length)[0];
      st.entity = (best && best.primary.temperature) || allIds[0] || null;
    }
    const root = main();
    if (!st.entity) { root.innerHTML = card('', '<div class="empty">' + esc(t('no_data')) + '</div>'); return; }
    const metric = metricOfId(st.entity);
    const select = '<label class="select"><span>' + esc(t('heatmap.sensor')) + '</span><select id="hm-entity">' + groups.map((g) => '<optgroup label="' + esc(g.room.name) + '">' + g.ids.map((id) => '<option value="' + esc(id) + '"' + (id === st.entity ? ' selected' : '') + '>' + esc(C.shortName(S.model, id, g.room.name) + (id.indexOf('|') > 0 ? ' (' + t('kind.thermostat') + ')' : '') + ' · ' + t('metric.' + metricOfId(id))) + '</option>').join('') + '</optgroup>').join('') + '</select></label>';
    root.innerHTML = card('', cardHead(t('heatmap.title')) + '<div class="controls">' + select + chips('days', [['7', t('range.7d')], ['14', '14 ' + (CP.i18n.lang === 'nl' ? 'dagen' : 'days')], ['30', t('range.30d')]], String(st.days)) + '</div><p class="muted small">' + esc(t('heatmap.hint')) + '</p><div id="hm" class="chart-box">' + loadingBox(320) + '</div>') +
      card('', cardHead(t('heatmap.profile')) + '<p class="muted small">' + esc(t('heatmap.profile_hint')) + '</p><div id="hm-profile" class="chart-box">' + loadingBox(240) + '</div>');
    document.getElementById('hm-entity').addEventListener('change', (e) => { st.entity = e.target.value; viewHeatmap(); });
    onChips(root, 'days', (v) => { st.days = +v; viewHeatmap(); });

    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    startDay.setDate(startDay.getDate() - (st.days - 1));
    const start = startDay.getTime();
    const end = Date.now();
    const points = Math.ceil((end - start) / H);
    const key = 'hm:' + st.entity + ':' + st.days;
    let data;
    try {
      data = await cached(key, 300000, () => CP.api.series([st.entity], { start, end, points }));
    } catch (e) { document.getElementById('hm').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (S.route.view !== 'heatmap' || key !== 'hm:' + st.entity + ':' + st.days) return;
    const s = seriesDisplay(st.entity, metric, data.series[st.entity]);
    if (!s || !s.v.some((v) => v != null)) { document.getElementById('hm').innerHTML = document.getElementById('hm-profile').innerHTML = '<div class="empty">' + esc(t('no_data')) + '</div>'; return; }

    // bucket into day × hour
    const rows = [];
    for (let d = 0; d < st.days; d++) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + d);
      rows.push({ date: day, label: F.date(day, { weekday: 'short', day: 'numeric' }), long: F.date(day, { weekday: 'long', day: 'numeric', month: 'long' }), sums: new Array(24).fill(0), counts: new Array(24).fill(0) });
    }
    s.t.forEach((tt, i) => {
      if (s.v[i] == null) return;
      const d = new Date(tt);
      const dayIdx = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / DAY);
      if (dayIdx < 0 || dayIdx >= rows.length) return;
      rows[dayIdx].sums[d.getHours()] += s.v[i];
      rows[dayIdx].counts[d.getHours()] += 1;
    });
    let lo = Infinity;
    let hi = -Infinity;
    rows.forEach((r) => {
      r.cells = r.sums.map((sum, hIdx) => {
        const v = r.counts[hIdx] ? sum / r.counts[hIdx] : null;
        if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        return { v };
      });
    });
    const o = S.model.opts;
    let color;
    let legend;
    if (metric === 'temperature') {
      const mid = disp('temperature', (o.temperature_comfort_min + o.temperature_comfort_max) / 2);
      const spread = Math.max(3 * (S.model.tempUnit === '°F' ? 1.8 : 1), Math.abs(hi - mid), Math.abs(lo - mid));
      color = (v) => C.scales.diverging(v, mid, spread, isDark());
      legend = { min: mid - spread, max: mid + spread };
    } else {
      const span = hi - lo || 1;
      color = (v) => C.scales.sequential((v - lo) / span, isDark());
      legend = { min: lo, max: hi };
    }
    CP.charts.heatmap(document.getElementById('hm'), { rows, color, format: (v) => fmtDisp(metric, v), legend });

    // daily profile
    const prof = { t: [], v: [], mn: [], mx: [] };
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let hIdx = 0; hIdx < 24; hIdx++) {
      const vals = rows.map((r) => r.cells[hIdx].v).filter((v) => v != null);
      prof.t.push(base.getTime() + hIdx * H + H / 2);
      prof.v.push(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
      prof.mn.push(vals.length ? Math.min.apply(null, vals) : null);
      prof.mx.push(vals.length ? Math.max.apply(null, vals) : null);
    }
    CP.charts.lineChart(document.getElementById('hm-profile'), {
      series: [Object.assign({ name: C.displayName(S.model, st.entity), color: slotColor(0) }, prof)],
      height: 240,
      start: base.getTime(),
      end: base.getTime() + DAY,
      showRange: true,
      band: bandFor(metric),
      bandInDomain: false,
      format: (v) => fmtDisp(metric, v)
    });
  }

  /* ------------------------------------------------------------------ */
  /* Comfort                                                             */
  /* ------------------------------------------------------------------ */
  function viewComfort() {
    const m = S.model;
    const o = m.opts;
    const ev = S.ev;
    const root = main();
    const rows = ev.rooms.filter((x) => x.values.temperature != null && x.values.humidity != null);
    let html = card('', cardHead(t('comfort.title')) + '<p class="muted small">' + esc(t('comfort.hint')) + '</p><div id="cf-chart" class="chart-box"></div>');
    // ventilation guide
    const out = ev.outdoor;
    let vent = '<p class="muted small">' + esc(t('comfort.ventilation_hint')) + '</p>';
    if (out.ah != null) {
      vent += '<div class="vent-out">' + icon('cloudsun') + esc(t('outdoor')) + ' <b>' + esc(F.num(out.ah, 1)) + ' g/m³</b> <span class="muted">(' + esc(F.temp(out.temperature, m)) + ', ' + esc(F.metric('humidity', out.humidity, m)) + ')</span></div><div class="vent-list">';
      const maxAh = Math.max.apply(null, rows.map((x) => x.ah).concat([out.ah, 1]));
      rows.forEach((x) => {
        const diff = x.ah - out.ah;
        const verdict = diff > 1 ? ['good', t('comfort.vent_yes')] : diff < -1 ? ['warning', t('comfort.vent_no')] : ['info', t('comfort.vent_neutral')];
        vent += '<div class="vent-row"><span class="vent-name">' + esc(x.room.name) + '</span><span class="vent-bars"><span class="vb vb-in" style="width:' + (x.ah / maxAh) * 100 + '%"></span><span class="vb vb-out" style="width:' + (out.ah / maxAh) * 100 + '%"></span></span><span class="num">' + esc(F.num(x.ah, 1)) + ' g/m³</span>' + statusTag(verdict[0], verdict[1]) + '</div>';
      });
      vent += '</div><div class="legend static"><span class="leg"><span class="sw" style="--c:' + slotColor(0) + '"></span>' + esc(t('hero.indoor')) + '</span><span class="leg"><span class="sw" style="--c:' + outdoorColor() + '"></span>' + esc(t('outdoor')) + '</span></div>';
    } else vent += '<div class="empty">' + esc(t('hero.no_outdoor')) + '</div>';
    html += '<div class="grid-2">' + card('', cardHead(t('comfort.ventilation')) + vent);
    // table
    let tbl = '<div class="table-wrap"><table class="tbl"><thead><tr><th>' + esc(t('col.room')) + '</th><th class="num">' + esc(t('hero.score')) + '</th><th class="num">' + esc(t('metric.temperature')) + '</th><th class="num">' + esc(t('metric.humidity')) + '</th><th class="num">' + esc(t('dewpoint')) + '</th><th class="num" title="' + esc(t('surface_rh_hint')) + '">' + esc(t('surface_rh')) + '</th><th>' + esc(t('mold')) + '</th></tr></thead><tbody>';
    ev.rooms.forEach((x) => {
      const moldLevel = x.mold === 'high' ? 'critical' : x.mold === 'elevated' ? 'warning' : 'good';
      tbl += '<tr class="clickable" data-room="' + esc(x.room.id) + '"><td><span class="sw" style="--c:' + slotColor(x.room.slot) + '"></span>' + esc(x.room.name) + '</td><td class="num">' + CP.charts.ring(x.score, { size: 30, stroke: 4, text: false }) + ' <b>' + (x.score == null ? '–' : x.score) + '</b></td><td class="num">' + esc(F.temp(x.values.temperature, m)) + '</td><td class="num">' + esc(F.metric('humidity', x.values.humidity, m)) + '</td><td class="num">' + esc(F.temp(x.dew, m)) + '</td><td class="num">' + esc(x.srh != null ? F.num(x.srh, 0) + '%' : '–') + '</td><td>' + (x.mold ? statusTag(moldLevel, t('mold.' + x.mold)) : '–') + '</td></tr>';
    });
    tbl += '</tbody></table></div><p class="muted small">' + esc(t('surface_rh_hint')) + '</p>';
    html += card('', cardHead(t('comfort.table')) + tbl) + '</div>';
    root.innerHTML = html;
    root.querySelectorAll('tr[data-room]').forEach((tr) => tr.addEventListener('click', () => (location.hash = '#/room/' + encodeURIComponent(tr.dataset.room))));

    const points = rows.map((x) => {
      const ts = spark(x.room.primary.temperature);
      const hs = spark(x.room.primary.humidity);
      const trail = [];
      if (ts && hs) for (let i = 0; i < ts.t.length; i += 3) { const k = CP.charts.nearest(hs.t, ts.t[i]); trail.push([ts.v[i], k >= 0 ? hs.v[k] : null]); }
      return {
        name: x.room.name,
        t: disp('temperature', x.values.temperature),
        h: x.values.humidity,
        color: slotColor(x.room.slot),
        trail,
        extra: [[t('metric.temperature'), F.temp(x.values.temperature, m)], [t('metric.humidity'), F.metric('humidity', x.values.humidity, m)], [t('dewpoint'), F.temp(x.dew, m)], [t('hero.score'), x.score == null ? '–' : String(x.score)]]
      };
    });
    CP.charts.comfortChart(document.getElementById('cf-chart'), {
      points,
      zone: { t0: disp('temperature', o.temperature_comfort_min), t1: disp('temperature', o.temperature_comfort_max), h0: o.humidity_comfort_min, h1: o.humidity_comfort_max },
      fmtT: (v) => F.num(v, 0) + '°',
      height: 400
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sensors                                                             */
  /* ------------------------------------------------------------------ */
  function viewSensors() {
    const root = main();
    const st = S.sensors;
    root.innerHTML = card('', cardHead(t('sensors.title'), '<span class="count" id="sn-count"></span>') +
      '<div class="controls"><input id="sn-q" class="search" type="search" placeholder="' + esc(t('sensors.search')) + '" value="' + esc(st.q) + '">' + chips('filter', [['all', t('filter.all')], ['issues', t('filter.issues')]], st.filter) + '</div>' +
      '<div class="table-wrap"><table class="tbl sensors"><thead><tr><th>' + esc(t('col.name')) + '</th><th>' + esc(t('col.room')) + '</th><th>' + esc(t('col.type')) + '</th><th class="num">' + esc(t('col.value')) + '</th><th>' + esc(t('col.updated')) + '</th><th class="num">' + esc(t('col.battery')) + '</th><th>' + esc(t('col.status')) + '</th></tr></thead><tbody id="sn-body"></tbody></table></div>');
    document.getElementById('sn-q').addEventListener('input', (e) => { st.q = e.target.value; renderSensorRows(); });
    onChips(root, 'filter', (v) => { st.filter = v; root.querySelectorAll('[data-chips="filter"] .chip').forEach((b) => { b.classList.toggle('active', b.dataset.val === v); b.setAttribute('aria-pressed', b.dataset.val === v); }); renderSensorRows(); });
    renderSensorRows();
  }
  function renderSensorRows() {
    const body = document.getElementById('sn-body');
    if (!body) return;
    const m = S.model;
    const st = S.sensors;
    const q = st.q.trim().toLowerCase();
    const list = C.sensorHealth(m)
      .map((h) => Object.assign(h, { room: m.rooms[h.entity.roomId] }))
      .filter((h) => st.filter === 'all' || h.status !== 'ok' || h.lowBattery)
      .filter((h) => !q || (C.displayName(m, h.id) + ' ' + h.id + ' ' + (h.room ? h.room.name : '')).toLowerCase().indexOf(q) >= 0)
      .sort((a, b) => (a.room ? a.room.name : '~').localeCompare(b.room ? b.room.name : '~') || a.id.localeCompare(b.id));
    document.getElementById('sn-count').textContent = list.length;
    if (!list.length) { body.innerHTML = '<tr><td colspan="7"><div class="empty">' + esc(t('no_data')) + '</div></td></tr>'; return; }
    body.innerHTML = list.map((h) => {
      const e = h.entity;
      const s = m.states[h.id];
      let value = '–';
      let type = '';
      if (e.kind === 'sensor') { value = F.metric(e.metric, C.sensorValue(s, e.metric), m); type = t('metric.' + e.metric); }
      else if (e.kind === 'opening') { value = s.state === 'on' ? t('open') : s.state === 'off' ? t('closed') : '–'; type = t('kind.opening'); }
      else if (e.kind === 'thermostat') { const th = C.thermostatInfo(m, h.id); value = F.temp(th.current, m); type = t('kind.thermostat'); }
      const status = h.status === 'unavailable' ? statusTag('critical', t('st.unavailable')) : h.status === 'stale' ? statusTag('warning', t('st.stale')) : h.lowBattery ? statusTag('warning', t('st.low_battery')) : statusTag('good', t('st.ok'));
      return '<tr><td><div>' + esc(C.displayName(m, h.id)) + '</div><div class="muted mono">' + esc(h.id) + '</div></td><td>' + esc(h.room ? h.room.name : '–') + '</td><td>' + esc(type) + '</td><td class="num"><b>' + esc(value) + '</b></td><td>' + esc(isFinite(h.reported) ? F.ago(h.reported) : '–') + '</td><td class="num">' + (h.battery != null ? icon('battery') + ' ' + esc(F.num(h.battery, 0)) + '%' : '–') + '</td><td>' + status + '</td></tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Room detail                                                         */
  /* ------------------------------------------------------------------ */
  async function viewRoom(live) {
    const m = S.model;
    const unassigned = S.route.id === '_none' ? S.ev.unassigned : null;
    const x = unassigned || S.ev.rooms.find((r) => r.room.id === S.route.id);
    const root = main();
    if (!x) { root.innerHTML = card('', '<a class="back" href="#/overview">' + icon('back') + esc(t('room.back')) + '</a><div class="empty">' + esc(t('room.not_found')) + '</div>'); return; }
    const r = x.room;
    const o = m.opts;
    const st = S.room;
    const keepCharts = live && document.getElementById('rm-charts') && document.getElementById('rm-charts').dataset.room === r.id;
    const savedCharts = keepCharts ? document.getElementById('rm-charts') : null;

    let html = '<a class="back" href="#/overview">' + icon('back') + esc(t('room.back')) + '</a>';
    if (unassigned) {
      html += '<div class="room-hero card"><div class="rh-title"><h1>' + esc(r.name) + '</h1><p class="muted">' + esc(t('unassigned.detail')) + '</p></div>' +
        '<a class="btn btn-ghost" href="#/settings/unassigned">' + icon('eyeoff') + esc(t('unassigned.manage')) + '</a></div>';
      html += card('', cardHead(t('unassigned.entities'), '<span class="count">' + x.count + '</span>') + unassignedRows(x));
    } else {
      html += '<div class="room-hero card"><div class="rh-title"><h1>' + esc(r.name) + '</h1><div class="muted">' + esc(floorName(r)) + '</div></div>' +
        '<div class="rh-score">' + CP.charts.ring(x.score, { size: 92, stroke: 9 }) + '<div>' + scoreTag(x.score) + '<div class="muted small">' + esc(t('room.breakdown')) + '</div>' +
        ['temperature', 'humidity', 'air'].filter((k) => x.parts[k] != null).map((k) => '<div class="mini-bar"><span>' + esc(t('score.part.' + k)) + '</span><div class="mb-track"><div class="mb-fill" style="width:' + x.parts[k] + '%;background:' + C.scales.score(x.parts[k]) + '"></div></div><b>' + x.parts[k] + '</b></div>').join('') + '</div></div></div>';

      // metric tiles
      const tiles = [];
      C.METRIC_ORDER.forEach((k) => {
        if (x.values[k] == null) return;
        tiles.push('<div class="tile">' + icon(C.METRICS[k].icon) + '<div class="tile-label">' + esc(t('metric.' + k)) + '</div><div class="tile-value">' + esc(F.metric(k, x.values[k], m)) + '</div>' + (k === 'co2' ? statusTag(co2Level(x.values.co2), t(co2Level(x.values.co2) === 'good' ? 'score.good' : co2Level(x.values.co2) === 'warning' ? 'level.warning' : 'score.poor')) : '') + '</div>');
      });
      if (x.dew != null) tiles.push('<div class="tile tile-derived">' + icon('drop') + '<div class="tile-label">' + esc(t('dewpoint')) + '</div><div class="tile-value">' + esc(F.temp(x.dew, m)) + '</div></div>');
      if (x.ah != null) tiles.push('<div class="tile tile-derived">' + icon('cloud') + '<div class="tile-label">' + esc(t('abs_humidity')) + '</div><div class="tile-value">' + esc(F.num(x.ah, 1)) + ' g/m³</div></div>');
      if (x.mold) tiles.push('<div class="tile tile-derived" title="' + esc(t('surface_rh_hint')) + '">' + icon('spore') + '<div class="tile-label">' + esc(t('mold')) + '</div><div class="tile-value">' + esc(x.srh != null ? F.num(x.srh, 0) + '%' : t('mold.' + x.mold)) + '</div>' + statusTag(x.mold === 'high' ? 'critical' : x.mold === 'elevated' ? 'warning' : 'good', t('mold.' + x.mold)) + '</div>');
      html += tiles.length ? '<div class="tiles">' + tiles.join('') + '</div>' : card('', '<div class="empty">' + esc(t('room.no_sensors')) + '</div>');
    }

    // devices
    const dev = [];
    x.thermostats.forEach((th) => {
      const active = th.action === 'heating' || th.action === 'preheating';
      dev.push('<div class="dev">' + icon(active ? 'flame' : 'thermo', active ? 'ic-heat' : '') + '<div><div>' + esc(th.name) + '</div><div class="muted small">' + esc([F.temp(th.current, m), th.target != null ? t('target', { v: F.temp(th.target, m) }) : null, th.preset].filter(Boolean).join(' · ')) + '</div></div><span class="dev-state">' + esc(th.action ? t(th.action) : th.mode) + '</span></div>');
    });
    r.openings.forEach((e) => {
      const s = m.states[e];
      const open = s && s.state === 'on';
      dev.push('<div class="dev">' + icon('window', open ? 'ic-open' : '') + '<div><div>' + esc(C.displayName(m, e)) + '</div><div class="muted small">' + esc(s ? F.ago(new Date(s.last_changed).getTime()) : '') + '</div></div><span class="dev-state">' + esc(open ? t('open') : t('closed')) + '</span></div>');
    });
    r.lights.concat(r.fans, r.humidifiers).forEach((e) => {
      const s = m.states[e];
      const on = s && s.state === 'on';
      const ic = e.startsWith('fan.') ? 'fan' : e.startsWith('humidifier.') ? 'drop' : 'bulb';
      dev.push('<div class="dev">' + icon(ic, on ? 'ic-on' : '') + '<div><div>' + esc(C.displayName(m, e)) + '</div></div><span class="dev-state">' + esc(on ? t('on') : t('off')) + '</span></div>');
    });
    r.batteries.forEach((e) => {
      const v = C.num(m.states[e] && m.states[e].state);
      dev.push('<div class="dev">' + icon('battery', v != null && v < o.low_battery_percent ? 'ic-warn' : '') + '<div><div>' + esc(C.displayName(m, e)) + '</div></div><span class="dev-state">' + esc(v == null ? '–' : F.num(v, 0) + '%') + '</span></div>');
    });
    if (dev.length && !unassigned) html += card('', cardHead(t('room.devices')) + '<div class="devs">' + dev.join('') + '</div>');

    html += card('', cardHead(t('room.history'), chips('rrange', [['24h', t('range.24h')], ['7d', t('range.7d')], ['30d', t('range.30d')]], st.range)) + '<div id="rm-charts" data-room="' + esc(r.id) + '">' + loadingBox(260) + '</div>');
    root.innerHTML = html;
    onChips(root, 'rrange', (v) => { st.range = v; viewRoom(); });
    if (savedCharts) { document.getElementById('rm-charts').replaceWith(savedCharts); return; }

    // history charts
    const metrics = C.METRIC_ORDER.filter((k) => r.sensors[k] || (k === 'temperature' && r.primary.temperature));
    const ids = [];
    metrics.forEach((k) => (r.sensors[k] || [r.primary[k]]).forEach((id) => ids.push(id)));
    r.thermostats.forEach((e) => ids.push(e));
    r.openings.forEach((e) => ids.push(e));
    const range = RANGES[st.range];
    const key = 'rm:' + r.id + ':' + st.range;
    let data;
    try {
      data = await cached(key, 120000, () => CP.api.series(ids, { hours: range.hours, points: range.points }));
    } catch (e) { document.getElementById('rm-charts').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
    if (S.route.view !== 'room' || S.route.id !== r.id || st.range !== key.split(':').pop()) return;
    const box = document.getElementById('rm-charts');
    box.innerHTML = '';
    const segs = [];
    r.thermostats.forEach((e) => ((data.series[e] && data.series[e].seg) || []).forEach((sg) => segs.push({ from: sg[0], to: sg[1], color: HEAT_SEG, label: t('heating_periods') })));
    r.openings.filter((e) => !m.entities[e].door).forEach((e) => ((data.series[e] && data.series[e].seg) || []).forEach((sg) => segs.push({ from: sg[0], to: sg[1], color: WINDOW_SEG, label: t('window_periods') + ' · ' + C.displayName(m, e) })));
    metrics.forEach((k) => {
      const list = r.sensors[k] || [r.primary[k]];
      const series = list.map((id, i) => Object.assign({ name: C.shortName(m, id, r.name), color: list.length > 1 || r.slot == null ? slotColor(i) : slotColor(r.slot) }, seriesDisplay(id, k, data.series[id]) || { t: [], v: [] }));
      const wrap = document.createElement('div');
      wrap.className = 'rm-chart';
      const stats = series.length === 1 ? seriesStats(series[0]) : null;
      const segLegend = (k === 'temperature' && segs.length) ? '<span class="leg"><span class="sw sw-block" style="--c:' + HEAT_SEG + '"></span>' + esc(t('heating_periods')) + '</span>' + (segs.some((sg) => sg.color === WINDOW_SEG) ? '<span class="leg"><span class="sw sw-block" style="--c:' + WINDOW_SEG + '"></span>' + esc(t('window_periods')) + '</span>' : '') : '';
      wrap.innerHTML = '<div class="rm-head"><h3>' + icon(C.METRICS[k].icon) + esc(t('metric.' + k)) + '</h3>' + (stats ? '<div class="rm-stats"><span>' + esc(t('stats.min')) + ' <b>' + esc(fmtDisp(k, stats.min)) + '</b></span><span>' + esc(t('stats.max')) + ' <b>' + esc(fmtDisp(k, stats.max)) + '</b></span><span>' + esc(t('stats.avg')) + ' <b>' + esc(fmtDisp(k, stats.avg)) + '</b></span></div>' : '') + '</div>' +
        (series.length > 1 || segLegend ? '<div class="legend static">' + (series.length > 1 ? series.map((s) => '<span class="leg"><span class="sw" style="--c:' + s.color + '"></span>' + esc(s.name) + '</span>').join('') : '') + segLegend + '</div>' : '') +
        '<div class="chart-box"></div>';
      box.appendChild(wrap);
      CP.charts.lineChart(wrap.querySelector('.chart-box'), {
        series,
        height: 220,
        start: data.start,
        end: data.end,
        band: bandFor(k),
        bandInDomain: k !== 'co2',
        showRange: true,
        segments: k === 'temperature' ? segs : [],
        format: (v) => fmtDisp(k, v)
      });
    });
    if (!metrics.length) box.innerHTML = '<div class="empty">' + esc(t('no_data')) + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Settings: entities hidden from the dashboard                        */
  /* ------------------------------------------------------------------ */
  function catalogInfo(item) {
    const m = S.model;
    const c = C.classify(item) || {};
    const a = item.attributes || {};
    const onOff = item.state === 'on' ? t('on') : item.state === 'off' ? t('off') : '–';
    if (c.kind === 'sensor') return { ic: C.METRICS[c.metric].icon, type: t('metric.' + c.metric), value: F.metric(c.metric, C.sensorValue(item, c.metric), m) };
    if (c.kind === 'battery') { const v = C.num(item.state); return { ic: 'battery', type: t('kind.battery'), value: v == null ? '–' : F.num(v, 0) + '%' }; }
    if (c.kind === 'thermostat') return { ic: 'thermo', type: t('kind.thermostat'), value: F.temp(C.normalise('temperature', a.current_temperature, m.tempUnit), m) };
    if (c.kind === 'opening') return { ic: 'window', type: t('kind.opening'), value: item.state === 'on' ? t('open') : item.state === 'off' ? t('closed') : '–' };
    if (c.kind === 'weather') return { ic: 'cloudsun', type: t('kind.weather'), value: (WX_LABEL[CP.i18n.lang] || WX_LABEL.en)[item.state] || item.state };
    if (c.kind === 'light') return { ic: 'bulb', type: t('kind.light'), value: onOff };
    if (c.kind === 'fan') return { ic: 'fan', type: t('kind.fan'), value: onOff };
    if (c.kind === 'humidifier') return { ic: 'drop', type: t('kind.humidifier'), value: onOff };
    return { ic: 'info', type: item.entity_id.split('.')[0], value: item.state || '–' };
  }

  async function viewSettings() {
    const st = S.settings;
    const root = main();
    root.innerHTML = card('settings', cardHead(t('settings.hidden'), '<span class="count" id="set-count"></span>') +
      '<p class="muted">' + esc(t('settings.hidden_hint')) + '</p>' +
      '<div id="set-msg"></div>' +
      '<div class="controls"><input id="set-q" class="search" type="search" placeholder="' + esc(t('settings.search')) + '" value="' + esc(st.q) + '">' +
      chips('sfilter', [['all', t('filter.all')], ['unassigned', t('unassigned')], ['hidden', t('settings.filter_hidden')]], st.filter) + '</div>' +
      '<div id="set-list">' + loadingBox(240) + '</div>' +
      '<div class="savebar" id="set-bar" role="status"><span id="set-changes"></span><span class="savebar-actions"><button type="button" class="btn btn-ghost" id="set-reset">' + esc(t('settings.cancel')) + '</button><button type="button" class="btn btn-primary" id="set-save">' + esc(t('settings.save')) + '</button></span></div>') +
      card('', cardHead(t('settings.other')) + '<p class="muted small">' + esc(t('settings.other_hint')) + '</p>');
    renderSettingsMessage();
    document.getElementById('set-q').addEventListener('input', (e) => { st.q = e.target.value; renderSettingsList(); });
    onChips(root, 'sfilter', (v) => {
      st.filter = v;
      root.querySelectorAll('[data-chips="sfilter"] .chip').forEach((b) => { b.classList.toggle('active', b.dataset.val === v); b.setAttribute('aria-pressed', b.dataset.val === v); });
      renderSettingsList();
    });
    document.getElementById('set-reset').addEventListener('click', () => { st.draft = savedExcluded(); renderSettingsList(); });
    document.getElementById('set-save').addEventListener('click', saveSettings);
    document.getElementById('set-list').addEventListener('change', onSettingsToggle);
    document.getElementById('set-list').addEventListener('click', onSettingsGroupToggle);

    if (!st.catalog) {
      try {
        st.catalog = await CP.api.entities();
      } catch (e) {
        const list = document.getElementById('set-list');
        if (list) list.innerHTML = '<div class="empty">' + esc(t('settings.load_error')) + '<span class="muted small">' + esc(e.message) + '</span></div>';
        return;
      }
      if (S.route.view !== 'settings') return;
    }
    if (!st.draft) st.draft = savedExcluded();
    renderSettingsList();
  }
  function savedExcluded() {
    const c = S.settings.catalog;
    return new Set(c ? c.entities.filter((e) => e.excluded_by === 'app').map((e) => e.entity_id) : []);
  }
  function settingsItems() {
    const st = S.settings;
    const areas = {};
    (st.catalog.areas || []).forEach((a) => (areas[a.area_id] = a.name));
    return st.catalog.entities.map((e) => {
      const locked = e.excluded_by === 'options';
      return Object.assign({}, e, catalogInfo(e), {
        name: (e.attributes && e.attributes.friendly_name) || e.entity_id,
        locked,
        hidden: locked || st.draft.has(e.entity_id),
        areaName: e.area_id ? areas[e.area_id] || e.area_id : null
      });
    });
  }
  function renderSettingsList() {
    const st = S.settings;
    const box = document.getElementById('set-list');
    if (!box || !st.catalog || !st.draft) return;
    const all = settingsItems();
    const q = st.q.trim().toLowerCase();
    const list = all
      .filter((e) => st.filter === 'all' || (st.filter === 'unassigned' ? !e.areaName : e.hidden))
      .filter((e) => !q || (e.name + ' ' + e.entity_id + ' ' + (e.areaName || t('unassigned')) + ' ' + (e.device || '') + ' ' + e.type).toLowerCase().indexOf(q) >= 0);
    document.getElementById('set-count').textContent = t('settings.n_hidden', { n: all.filter((e) => e.hidden).length });
    const groups = [];
    list.forEach((e) => {
      const key = e.areaName || '';
      let g = groups.find((x) => x.key === key);
      if (!g) { g = { key, name: e.areaName || t('unassigned'), items: [] }; groups.push(g); }
      g.items.push(e);
    });
    // area-less entities first: that is where most clean-up happens
    groups.sort((a, b) => (a.key === '' ? -1 : b.key === '' ? 1 : a.name.localeCompare(b.name)));
    groups.forEach((g) => g.items.sort((a, b) => a.name.localeCompare(b.name)));
    if (!groups.length) { box.innerHTML = '<div class="empty">' + esc(t(st.filter === 'hidden' && !q ? 'settings.none_hidden' : 'no_data')) + '</div>'; updateSaveBar(); return; }
    box.innerHTML = groups.map((g) => {
      const free = g.items.filter((e) => !e.locked);
      const allHidden = free.length && free.every((e) => e.hidden);
      return '<div class="pick-group"><div class="pick-group-head"><h3>' + esc(g.name) + ' <span class="count">' + g.items.length + '</span></h3>' +
        (free.length > 1 ? '<button type="button" class="btn-link" data-group="' + esc(g.key) + '" data-hide="' + (allHidden ? '0' : '1') + '">' + esc(t(allHidden ? 'settings.show_all' : 'settings.hide_all')) + '</button>' : '') + '</div>' +
        g.items.map((e) =>
          '<label class="pick' + (e.hidden ? ' is-hidden' : '') + (e.locked ? ' locked' : '') + '">' +
          '<span class="pick-ic">' + icon(e.ic) + '</span>' +
          '<span class="pick-main"><span class="pick-name">' + esc(e.name) + '</span><span class="mono">' + esc(e.entity_id) + '</span></span>' +
          '<span class="pick-meta muted small">' + esc([e.type, e.device].filter(Boolean).join(' · ')) + '</span>' +
          '<span class="pick-val">' + esc(e.value) + '</span>' +
          '<span class="pick-toggle"' + (e.locked ? ' title="' + esc(t('settings.locked_hint')) + '"' : '') + '><input type="checkbox" data-id="' + esc(e.entity_id) + '"' + (e.hidden ? ' checked' : '') + (e.locked ? ' disabled' : '') + '><span>' + esc(t(e.locked ? 'settings.locked' : 'settings.hide')) + '</span></span>' +
          '</label>').join('') + '</div>';
    }).join('');
    updateSaveBar();
  }
  function onSettingsToggle(e) {
    const cb = e.target.closest('input[type=checkbox][data-id]');
    if (!cb) return;
    const st = S.settings;
    if (cb.checked) st.draft.add(cb.dataset.id); else st.draft.delete(cb.dataset.id);
    cb.closest('.pick').classList.toggle('is-hidden', cb.checked);
    if (st.filter === 'hidden') return updateSaveBar(); // keep the row visible until the list is redrawn
    renderSettingsList();
  }
  function onSettingsGroupToggle(e) {
    const b = e.target.closest('[data-group]');
    if (!b) return;
    e.preventDefault();
    const st = S.settings;
    const q = st.q.trim().toLowerCase();
    settingsItems()
      .filter((x) => (x.areaName || '') === b.dataset.group && !x.locked)
      .filter((x) => st.filter === 'all' || (st.filter === 'unassigned' ? !x.areaName : x.hidden))
      .filter((x) => !q || (x.name + ' ' + x.entity_id + ' ' + (x.device || '') + ' ' + x.type).toLowerCase().indexOf(q) >= 0)
      .forEach((x) => { if (b.dataset.hide === '1') st.draft.add(x.entity_id); else st.draft.delete(x.entity_id); });
    renderSettingsList();
  }
  function settingsChanges() {
    const st = S.settings;
    if (!st.draft || !st.catalog) return 0;
    const saved = savedExcluded();
    let n = 0;
    st.draft.forEach((id) => { if (!saved.has(id)) n++; });
    saved.forEach((id) => { if (!st.draft.has(id)) n++; });
    return n;
  }
  function updateSaveBar() {
    const bar = document.getElementById('set-bar');
    if (!bar) return;
    const n = settingsChanges();
    bar.classList.toggle('show', n > 0 || S.settings.saving);
    document.getElementById('set-changes').textContent = S.settings.saving ? t('settings.saving') : t(n === 1 ? 'settings.one_change' : 'settings.n_changes', { n });
    document.getElementById('set-save').disabled = S.settings.saving || n === 0;
    document.getElementById('set-reset').disabled = S.settings.saving;
  }
  function renderSettingsMessage() {
    const el = document.getElementById('set-msg');
    const msg = S.settings.message;
    if (el) el.innerHTML = msg ? '<div class="msg msg-' + msg.level + '">' + icon(msg.level === 'good' ? 'check' : 'alert') + esc(msg.text) + '</div>' : '';
  }
  async function saveSettings() {
    const st = S.settings;
    if (st.saving || !settingsChanges()) return;
    st.saving = true;
    updateSaveBar();
    try {
      const res = await CP.api.saveExcluded(Array.from(st.draft).sort());
      const n = (res.exclude_entities || []).length;
      st.message = { level: 'good', text: t('settings.saved', { n }) };
      st.catalog = null;
      st.draft = null;
      st.saving = false;
      await load(); // redraws the dashboard and this page with the new selection
    } catch (e) {
      st.saving = false;
      st.message = { level: 'critical', text: t('settings.save_error') + ' ' + e.message };
      renderSettingsMessage();
      updateSaveBar();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    CP.i18n.setLanguage('auto');
    applyTheme();
    renderShell();
    start();
    window.addEventListener('hashchange', route);
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const fn = () => { if (applyTheme()) renderView(); };
      if (mq.addEventListener) mq.addEventListener('change', fn);
    }
    document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.chart')) S.lastChartTouch = Date.now(); }, { passive: true });
    setInterval(tick, 4000);
  });
})();
