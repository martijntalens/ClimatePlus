/*
 * ClimatePlus ventilation card for Home Assistant dashboards.
 *
 * Shows per room whether airing dries the room: compares the absolute humidity
 * (grams of water per m³) indoors with outdoors. Rooms and the outdoor source
 * are found automatically from areas and device classes; everything can be
 * overridden in the card configuration. Read-only, no external requests.
 *
 *   type: custom:climateplus-ventilation-card
 */
(() => {
  'use strict';
  const VERSION = '1.0.0';
  const TAG = 'climateplus-ventilation-card';

  const OUTDOOR_RE = /(^|[\s_.-])(buiten|outdoor|outside|exterior|garden|tuin|achtertuin|voortuin|balkon|balcony|terras|terrace|patio|yard|dakterras)([\s_.-]|$)/i;
  const WEATHER_PLATFORMS = new Set(['buienradar', 'met', 'met_eireann', 'openweathermap', 'accuweather', 'pirateweather', 'knmi', 'weatherflow', 'weatherflow_cloud', 'tomorrowio', 'meteo_france', 'metoffice', 'open_meteo', 'smhi', 'nws', 'environment_canada', 'ipma', 'aemet', 'bom', 'brightsky', 'weatherkit', 'google_weather']);

  const TEXT = {
    nl: {
      title: 'Ventilatiewijzer',
      hint: 'Luchten droogt alleen als de buitenlucht minder vocht bevat (in gram per m³) dan de binnenlucht — ook als de relatieve vochtigheid buiten hoger lijkt.',
      outdoor: 'Buiten',
      indoor: 'Binnen',
      yes: 'Luchten droogt',
      no: 'Luchten maakt vochtiger',
      neutral: 'Weinig verschil',
      no_data: 'Geen data',
      no_outdoor: 'Geen buitensensor of weer-entiteit gevonden. Stel outdoor_temperature en outdoor_humidity of weather in.',
      no_rooms: 'Geen ruimtes met zowel een temperatuur- als een vochtigheidssensor gevonden.',
      f_title: 'Titel',
      f_areas: 'Ruimtes (leeg = automatisch)',
      f_outdoor_temperature: 'Buitentemperatuur (optioneel)',
      f_outdoor_humidity: 'Buitenvochtigheid (optioneel)',
      f_weather: 'Weer-entiteit (optioneel)',
      f_show_hint: 'Uitleg tonen',
      f_show_legend: 'Legenda tonen'
    },
    en: {
      title: 'Ventilation guide',
      hint: 'Airing only dries a room when outdoor air holds less water (grams per m³) than indoor air — even if outdoor relative humidity looks higher.',
      outdoor: 'Outdoor',
      indoor: 'Indoor',
      yes: 'Airing dries',
      no: 'Airing adds moisture',
      neutral: 'Little difference',
      no_data: 'No data',
      no_outdoor: 'No outdoor sensor or weather entity found. Set outdoor_temperature and outdoor_humidity, or weather.',
      no_rooms: 'No areas with both a temperature and a humidity sensor found.',
      f_title: 'Title',
      f_areas: 'Areas (empty = automatic)',
      f_outdoor_temperature: 'Outdoor temperature (optional)',
      f_outdoor_humidity: 'Outdoor humidity (optional)',
      f_weather: 'Weather entity (optional)',
      f_show_hint: 'Show explanation',
      f_show_legend: 'Show legend'
    }
  };
  const langOf = (hass) => (String((hass && ((hass.locale && hass.locale.language) || hass.language)) || document.documentElement.lang || navigator.language || 'en').toLowerCase().startsWith('nl') ? 'nl' : 'en');

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  };
  const toC = (v, unit) => (v == null ? null : unit === '°F' ? (v - 32) * 5 / 9 : v);
  /** absolute humidity in g/m³ (Magnus formula) */
  function absHumidity(T, RH) {
    if (T == null || RH == null) return null;
    const psat = 6.112 * Math.exp((17.62 * T) / (243.12 + T));
    return (216.7 * ((RH / 100) * psat)) / (273.15 + T);
  }

  class ClimatePlusVentilationCard extends HTMLElement {
    static getStubConfig() {
      return {};
    }

    static getConfigForm() {
      return {
        schema: [
          { name: 'title', selector: { text: {} } },
          { name: 'areas', selector: { area: { multiple: true } } },
          {
            type: 'grid', name: '', flatten: true, schema: [
              { name: 'outdoor_temperature', selector: { entity: { filter: { domain: 'sensor', device_class: 'temperature' } } } },
              { name: 'outdoor_humidity', selector: { entity: { filter: { domain: 'sensor', device_class: 'humidity' } } } }
            ]
          },
          { name: 'weather', selector: { entity: { filter: { domain: 'weather' } } } },
          {
            type: 'grid', name: '', flatten: true, schema: [
              { name: 'show_hint', selector: { boolean: {} } },
              { name: 'show_legend', selector: { boolean: {} } }
            ]
          }
        ],
        computeLabel: (s) => TEXT[langOf()]['f_' + s.name] || s.name
      };
    }

    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('Invalid configuration');
      if (config.rooms && !Array.isArray(config.rooms)) throw new Error('rooms must be a list');
      (config.rooms || []).forEach((r) => {
        if (!r || !r.temperature || !r.humidity) throw new Error('Every room needs temperature and humidity');
      });
      this._config = Object.assign({ show_hint: true, show_legend: true, margin: 1 }, config);
      this._sig = null;
      if (this._hass) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    getCardSize() {
      return 2 + (this._rows || 3);
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6 };
    }

    /* ---------------------------------------------------------------- */
    /* Data                                                              */
    /* ---------------------------------------------------------------- */
    _areaOf(eid) {
      const h = this._hass;
      const e = (h.entities || {})[eid];
      if (!e) return null;
      if (e.area_id) return e.area_id;
      const d = e.device_id && (h.devices || {})[e.device_id];
      return (d && d.area_id) || null;
    }

    _value(eid, kind) {
      const st = eid && this._hass.states[eid];
      if (!st) return null;
      const v = num(st.state);
      return kind === 'temperature' ? toC(v, st.attributes.unit_of_measurement) : v;
    }

    /** climate sensors per area: { area_id: { temperature: [ids], humidity: [ids] } } */
    _sensorsByArea() {
      const h = this._hass;
      const by = {};
      Object.keys(h.states).forEach((eid) => {
        if (!eid.startsWith('sensor.')) return;
        const a = h.states[eid].attributes || {};
        const kind = a.device_class === 'temperature' || a.unit_of_measurement === '°C' || a.unit_of_measurement === '°F'
          ? 'temperature'
          : a.device_class === 'humidity' && (!a.unit_of_measurement || a.unit_of_measurement === '%') ? 'humidity' : null;
        if (!kind) return;
        const reg = (h.entities || {})[eid] || {};
        if (reg.entity_category || reg.hidden) return;
        const area = this._areaOf(eid);
        if (!area) return;
        by[area] = by[area] || { temperature: [], humidity: [] };
        by[area][kind].push(eid);
      });
      Object.values(by).forEach((s) => { s.temperature.sort(); s.humidity.sort(); });
      return by;
    }

    _rooms(by) {
      const h = this._hass;
      const c = this._config;
      const areas = h.areas || {};
      if (c.rooms && c.rooms.length) {
        return c.rooms.map((r) => ({ name: r.name || (h.states[r.humidity] && h.states[r.humidity].attributes.friendly_name) || r.humidity, t: r.temperature, h: r.humidity }));
      }
      let ids = c.areas && c.areas.length ? c.areas.slice() : Object.keys(by).filter((id) => !OUTDOOR_RE.test((areas[id] && areas[id].name) || id));
      if (!(c.areas && c.areas.length)) {
        const floors = h.floors || {};
        const level = (id) => {
          const f = areas[id] && floors[areas[id].floor_id];
          return f && f.level != null ? f.level : 999;
        };
        ids.sort((a, b) => level(a) - level(b) || String((areas[a] || {}).name || a).localeCompare(String((areas[b] || {}).name || b)));
      }
      return ids.map((id) => {
        const s = by[id] || { temperature: [], humidity: [] };
        const area = areas[id] || {};
        const pick = (kind) => {
          const pref = area[kind + '_entity_id'];
          return pref && h.states[pref] ? pref : s[kind][0] || null;
        };
        return { name: area.name || id, t: pick('temperature'), h: pick('humidity') };
      }).filter((r) => r.t && r.h);
    }

    _outdoor(by) {
      const h = this._hass;
      const c = this._config;
      const out = { t: null, h: null, ids: [] };
      if (c.outdoor_temperature) { out.t = this._value(c.outdoor_temperature, 'temperature'); out.ids.push(c.outdoor_temperature); }
      if (c.outdoor_humidity) { out.h = this._value(c.outdoor_humidity, 'humidity'); out.ids.push(c.outdoor_humidity); }
      if (out.t != null && out.h != null) return out;
      // an outdoor area (Tuin, Buiten, Balkon, ...)
      const areas = h.areas || {};
      const outdoorArea = Object.keys(by).find((id) => OUTDOOR_RE.test((areas[id] && areas[id].name) || id) && by[id].temperature.length && by[id].humidity.length);
      if (outdoorArea) {
        if (out.t == null) { out.t = this._value(by[outdoorArea].temperature[0], 'temperature'); out.ids.push(by[outdoorArea].temperature[0]); }
        if (out.h == null) { out.h = this._value(by[outdoorArea].humidity[0], 'humidity'); out.ids.push(by[outdoorArea].humidity[0]); }
        if (out.t != null && out.h != null) return out;
      }
      // a weather entity
      let w = c.weather && h.states[c.weather] ? c.weather : null;
      if (!w) {
        const all = Object.keys(h.states).filter((e) => e.startsWith('weather.'));
        w = all.find((e) => /home|forecast|thuis/.test(e)) || all[0] || null;
      }
      if (w) {
        const a = h.states[w].attributes || {};
        if (out.t == null) out.t = toC(num(a.temperature), a.temperature_unit);
        if (out.h == null) out.h = num(a.humidity);
        out.ids.push(w);
        out.weather = w;
      }
      return out;
    }

    /* ---------------------------------------------------------------- */
    /* Rendering                                                         */
    /* ---------------------------------------------------------------- */
    _render() {
      const h = this._hass;
      const c = this._config;
      if (!h || !c) return;
      const L = TEXT[langOf(h)];
      const by = this._sensorsByArea();
      const rooms = this._rooms(by);
      const out = this._outdoor(by);
      const dark = !!(h.themes && h.themes.darkMode);
      // redraw only when something we show changed (hass updates arrive constantly)
      const ids = out.ids.concat(...rooms.map((r) => [r.t, r.h]));
      const sig = JSON.stringify([L.title, dark, c, rooms.map((r) => r.name), ids.map((e) => (h.states[e] ? h.states[e].state + '|' + (h.states[e].attributes.temperature || '') + '|' + (h.states[e].attributes.humidity || '') : ''))]);
      if (sig === this._sig) return;
      this._sig = sig;
      this._rows = rooms.length;

      const fmt = (v, d) => (v == null ? '–' : new Intl.NumberFormat(L === TEXT.nl ? 'nl-NL' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));
      const outAh = absHumidity(out.t, out.h);
      const list = rooms.map((r) => {
        const T = this._value(r.t, 'temperature');
        const RH = this._value(r.h, 'humidity');
        return Object.assign({}, r, { T, RH, ah: absHumidity(T, RH) });
      });
      const maxAh = Math.max(1, outAh || 0, ...list.map((r) => r.ah || 0));
      const colors = dark
        ? { inBar: '#3987e5', outBar: '#898781', good: ['rgba(12,163,12,.16)', '#0ca30c'], warning: ['rgba(250,178,25,.18)', '#fab219'], info: ['rgba(57,135,229,.16)', '#86b6ef'] }
        : { inBar: '#2a78d6', outBar: '#898781', good: ['rgba(12,163,12,.12)', '#006300'], warning: ['rgba(250,178,25,.18)', '#7a5200'], info: ['rgba(42,120,214,.10)', '#1c5cab'] };
      const tag = (level, label, icon) => '<span class="tag" style="background:' + colors[level][0] + ';color:' + colors[level][1] + '"><ha-icon icon="' + icon + '"></ha-icon>' + esc(label) + '</span>';

      let body = '';
      if (c.show_hint) body += '<p class="hint">' + esc(L.hint) + '</p>';
      if (outAh == null) {
        body += '<div class="empty">' + esc(L.no_outdoor) + '</div>';
      } else {
        body += '<div class="out" data-entity="' + esc(out.weather || out.ids[out.ids.length - 1] || '') + '"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon>' + esc(L.outdoor) +
          ' <b>' + fmt(outAh, 1) + ' g/m³</b> <span class="muted">(' + fmt(out.t, 1) + '°C, ' + fmt(out.h, 0) + '%)</span></div>';
        if (!list.length) body += '<div class="empty">' + esc(L.no_rooms) + '</div>';
        body += '<div class="rows">' + list.map((r) => {
          let verdict = '';
          if (r.ah != null) {
            const diff = r.ah - outAh;
            verdict = diff > c.margin ? tag('good', L.yes, 'mdi:check-circle-outline') : diff < -c.margin ? tag('warning', L.no, 'mdi:alert-outline') : tag('info', L.neutral, 'mdi:information-outline');
          } else verdict = '<span class="muted small">' + esc(L.no_data) + '</span>';
          const title = fmt(r.T, 1) + '°C · ' + fmt(r.RH, 0) + '%';
          return '<div class="row" role="button" tabindex="0" data-entity="' + esc(r.h) + '" title="' + esc(title) + '">' +
            '<span class="name">' + esc(r.name) + '</span>' +
            '<span class="bars"><span class="bar" style="width:' + ((r.ah || 0) / maxAh) * 100 + '%;background:' + colors.inBar + '"></span><span class="bar" style="width:' + (outAh / maxAh) * 100 + '%;background:' + colors.outBar + '"></span></span>' +
            '<span class="val">' + fmt(r.ah, 1) + ' g/m³</span>' + verdict + '</div>';
        }).join('') + '</div>';
        if (c.show_legend && list.length) body += '<div class="legend"><span><i style="background:' + colors.inBar + '"></i>' + esc(L.indoor) + '</span><span><i style="background:' + colors.outBar + '"></i>' + esc(L.outdoor) + '</span></div>';
      }

      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style>' + STYLE + '</style><ha-card' + (c.title === '' ? '' : ' header="' + esc(c.title || L.title) + '"') + '><div class="card-content' + (c.title === '' ? ' no-header' : '') + '">' + body + '</div></ha-card>';
      this.shadowRoot.querySelectorAll('[data-entity]').forEach((el) => {
        if (!el.dataset.entity) return;
        const open = () => this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }
  }

  const STYLE = `
    :host { display: block; }
    .card-content { padding: 0 16px 16px; }
    .card-content.no-header { padding-top: 16px; }
    .hint { margin: 0 0 12px; color: var(--secondary-text-color); font-size: 13px; line-height: 1.45; }
    .muted { color: var(--secondary-text-color); }
    .small { font-size: 12px; }
    .out { display: flex; align-items: center; gap: 8px; margin: 4px 0 12px; cursor: pointer; flex-wrap: wrap; }
    .out ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
    .rows { display: flex; flex-direction: column; gap: 4px; }
    .row { display: grid; grid-template-columns: minmax(70px, 120px) 1fr auto auto; gap: 10px; align-items: center; font-size: 14px; padding: 4px 6px; margin: 0 -6px; border-radius: 8px; cursor: pointer; }
    .row:hover, .row:focus-visible { background: var(--secondary-background-color, rgba(127,127,127,.08)); outline: none; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bars { display: flex; flex-direction: column; gap: 3px; min-width: 40px; }
    .bar { display: block; height: 6px; border-radius: 4px; min-width: 2px; }
    .val { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; min-width: 64px; }
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px 2px 7px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .tag ha-icon { --mdc-icon-size: 14px; }
    .legend { display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: var(--secondary-text-color); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; }
    .empty { color: var(--secondary-text-color); padding: 8px 0; }
    @container (max-width: 380px) {
      .row { grid-template-columns: 1fr auto; }
      .row .bars { grid-column: 1 / -1; grid-row: 2; }
      .row .tag { grid-column: 1 / -1; justify-self: start; }
    }
    ha-card { container-type: inline-size; }
  `;

  if (!customElements.get(TAG)) customElements.define(TAG, ClimatePlusVentilationCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === TAG)) {
    window.customCards.push({
      type: TAG,
      name: 'ClimatePlus ventilation guide',
      description: 'Shows per room whether airing dries the room (absolute humidity indoor vs outdoor).',
      preview: true,
      documentationURL: 'https://github.com/martijntalens/ClimatePlus#ventilation-card'
    });
  }
  console.info('%c CLIMATEPLUS-VENTILATION-CARD %c ' + VERSION + ' ', 'color:#fff;background:#2a78d6;font-weight:700', 'color:#2a78d6;background:transparent');
})();
