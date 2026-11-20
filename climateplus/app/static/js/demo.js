/* ClimatePlus — deterministic demo data (used with ?demo, demo_mode or file://) */
(function () {
  'use strict';
  const CP = (window.CP = window.CP || {});
  const HOUR = 3600000;
  const DAY = 24 * HOUR;

  function hash(str, n) {
    let h = 2166136261 ^ n;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // smooth value noise in [-1, 1]
  function noise(key, t, periodMs) {
    const x = t / periodMs;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return (hash(key, i) * (1 - s) + hash(key, i + 1) * s) * 2 - 1;
  }
  const hourOf = (t) => { const d = new Date(t); return d.getHours() + d.getMinutes() / 60; };
  const bump = (h, center, width) => { const d = Math.min(Math.abs(h - center), 24 - Math.abs(h - center)); return Math.exp(-(d * d) / (2 * width * width)); };

  const AREAS = [
    { area_id: 'woonkamer', name: 'Woonkamer', floor_id: 'bg' },
    { area_id: 'keuken', name: 'Keuken', floor_id: 'bg' },
    { area_id: 'garage', name: 'Garage', floor_id: 'bg' },
    { area_id: 'slaapkamer', name: 'Slaapkamer', floor_id: 'v1' },
    { area_id: 'kinderkamer', name: 'Kinderkamer', floor_id: 'v1' },
    { area_id: 'badkamer', name: 'Badkamer', floor_id: 'v1' },
    { area_id: 'werkkamer', name: 'Werkkamer', floor_id: 'v2' },
    { area_id: 'tuin', name: 'Tuin', floor_id: null }
  ];
  const FLOORS = [
    { floor_id: 'bg', name: 'Begane grond', level: 0 },
    { floor_id: 'v1', name: 'Eerste verdieping', level: 1 },
    { floor_id: 'v2', name: 'Zolder', level: 2 }
  ];

  // profile per room: base temperature, humidity base, co2 profile, etc.
  const ROOMS = {
    woonkamer: { temp: 21.2, hum: 47, co2: 'living', lux: 0.03, voc: true, pm: true },
    keuken: { temp: 20.6, hum: 53, cook: true },
    garage: { temp: 13.2, hum: 66, stale: true },
    slaapkamer: { temp: 18.6, hum: 55, co2: 'bed' },
    kinderkamer: { temp: 19.4, hum: 51, co2: 'kid' },
    badkamer: { temp: 21.8, hum: 70, shower: true },
    werkkamer: { temp: 23.4, hum: 42, co2: 'work', lux: 0.05 },
    tuin: { outdoor: true }
  };

  function outdoorTemp(t) {
    const h = hourOf(t);
    return 6.2 + 3.1 * Math.sin((2 * Math.PI * (h - 9)) / 24) + 2.2 * noise('out', t, 2.5 * DAY) + 0.4 * noise('outf', t, 2 * HOUR) - 1.5 * Math.cos((2 * Math.PI * (t / DAY)) / 365);
  }
  function daylight(t) {
    const h = hourOf(t);
    if (h < 8.2 || h > 16.8) return 0;
    const f = Math.sin((Math.PI * (h - 8.2)) / 8.6);
    return Math.max(0, 14000 * f * (0.55 + 0.45 * noise('cloud', t, 3 * HOUR)));
  }

  function value(metric, roomId, t) {
    const p = ROOMS[roomId];
    const h = hourOf(t);
    const key = roomId + metric;
    if (p.outdoor) {
      if (metric === 'temperature') return outdoorTemp(t);
      if (metric === 'humidity') return Math.min(99, 84 - 2.2 * (outdoorTemp(t) - 6) + 6 * noise('outh', t, DAY));
      if (metric === 'illuminance') return daylight(t);
      if (metric === 'pressure') return 1016 + 9 * noise('press', t, 3 * DAY);
    }
    const setback = (h >= 23 || h < 6) ? -1.3 : (h >= 6 && h < 8) ? -0.4 : 0;
    const temp = p.temp + setback + 0.6 * Math.sin((2 * Math.PI * (h - 10)) / 24) + 0.35 * noise(key + 't', t, 1.5 * HOUR) + 0.5 * noise(key + 'd', t, 3 * DAY) + (outdoorTemp(t) - 6) * 0.06;
    if (metric === 'temperature') return temp;
    if (metric === 'humidity') {
      let rh = p.hum - (temp - p.temp) * 1.6 + 3 * noise(key + 'h', t, 6 * HOUR);
      if (p.shower) rh += 20 * bump(h, 7.2, 0.5) + 16 * bump(h, 21.5, 0.6);
      if (p.cook) rh += 9 * bump(h, 18.4, 0.7);
      return Math.min(98, rh);
    }
    if (metric === 'co2') {
      let c = 470 + 40 * noise(key + 'c', t, 2 * HOUR);
      if (p.co2 === 'living') c += 520 * bump(h, 20, 2.2) + 200 * bump(h, 13, 1.5);
      if (p.co2 === 'bed') c += 780 * bump(h, 3.5, 2.8);
      if (p.co2 === 'kid') c += 600 + 650 * bump(h, 2.5, 3.5);
      if (p.co2 === 'work') c += 420 * bump(h, 11, 2) + 380 * bump(h, 15, 1.8);
      return c;
    }
    if (metric === 'illuminance') return daylight(t) * (p.lux || 0.02) + (h > 17 && h < 23 ? 140 : 0) + 4;
    if (metric === 'voc') return 130 + 260 * bump(h, 18.5, 0.8) + 40 * noise(key + 'v', t, 3 * HOUR);
    if (metric === 'pm25') return 4.5 + 14 * bump(h, 18.6, 0.6) + 2 * noise(key + 'p', t, 4 * HOUR);
    return null;
  }

  const SENSORS = [];
  const add = (roomId, metric, unit, dc, name) => SENSORS.push({ id: 'sensor.' + roomId + '_' + metric, roomId, metric, unit, dc, name });
  Object.keys(ROOMS).forEach((r) => {
    const room = AREAS.find((a) => a.area_id === r).name;
    add(r, 'temperature', '°C', 'temperature', room + ' Temperatuur');
    add(r, 'humidity', '%', 'humidity', room + ' Luchtvochtigheid');
    if (ROOMS[r].co2) add(r, 'co2', 'ppm', 'carbon_dioxide', room + ' CO2');
    if (ROOMS[r].lux || ROOMS[r].outdoor) add(r, 'illuminance', 'lx', 'illuminance', room + ' Lichtsterkte');
    if (ROOMS[r].voc) add(r, 'voc', 'ppb', 'volatile_organic_compounds_parts', room + ' VOC');
    if (ROOMS[r].pm) add(r, 'pm25', 'µg/m³', 'pm25', room + ' PM2.5');
    if (ROOMS[r].outdoor) add(r, 'pressure', 'hPa', 'atmospheric_pressure', room + ' Luchtdruk');
  });
  // Sensors without an area (a phone, a forgotten thermometer) and a weather service
  [
    { id: 'sensor.pixel_8_light_sensor', metric: 'illuminance', unit: 'lx', dc: 'illuminance', name: 'Pixel 8 Lichtsensor', dev: 'dev_pixel', devName: 'Pixel 8', platform: 'mobile_app', fn: (t) => 15 + daylight(t) * 0.012 + 40 * Math.max(0, noise('px', t, HOUR)) },
    { id: 'sensor.pixel_8_pressure_sensor', metric: 'pressure', unit: 'hPa', dc: 'atmospheric_pressure', name: 'Pixel 8 Luchtdruk', dev: 'dev_pixel', devName: 'Pixel 8', platform: 'mobile_app', fn: (t) => 1011 + 9 * noise('press', t, 3 * DAY) },
    { id: 'sensor.thermometer_hal_temperature', metric: 'temperature', unit: '°C', dc: 'temperature', name: 'Thermometer hal Temperatuur', dev: 'dev_hal', devName: 'Thermometer hal', platform: 'zha', fn: (t) => value('temperature', 'keuken', t) - 1.7 },
    { id: 'sensor.thermometer_hal_humidity', metric: 'humidity', unit: '%', dc: 'humidity', name: 'Thermometer hal Luchtvochtigheid', dev: 'dev_hal', devName: 'Thermometer hal', platform: 'zha', fn: (t) => value('humidity', 'keuken', t) - 3 },
    { id: 'sensor.buienradar_temperature', metric: 'temperature', unit: '°C', dc: 'temperature', name: 'Buienradar Temperatuur', dev: 'dev_buienradar', devName: 'Buienradar', platform: 'buienradar', service: true, fn: (t) => outdoorTemp(t) + 0.4 }
  ].forEach((s) => SENSORS.push(Object.assign({ roomId: null }, s)));
  const sensorValueAt = (s, t) => (s.fn ? s.fn(t) : value(s.metric, s.roomId, t));
  const isStale = (s) => !!(s.roomId && ROOMS[s.roomId].stale);

  // Hidden entities (the settings page); kept in this browser only
  let excluded = [];
  try { excluded = JSON.parse(localStorage.getItem('climateplus.demo_excluded') || '[]'); } catch (e) { excluded = []; }

  const dec = { temperature: 1, humidity: 0, co2: 0, illuminance: 0, voc: 0, pm25: 1, pressure: 1 };
  const round = (v, d) => (v == null ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d));

  function heatingActive(roomId, t) {
    const h = hourOf(t);
    if (roomId === 'woonkamer') return (h >= 6.3 && h < 8.5) || (h >= 16.5 && h < 22.5) || (h >= 9 && h < 16 && value('temperature', 'woonkamer', t) < 20.2);
    if (roomId === 'slaapkamer') return h >= 21 && h < 22;
    return false;
  }

  let boot = null;
  function bootstrap() {
    if (boot) return withExcluded(JSON.parse(JSON.stringify(boot)));
    const now = Date.now();
    const iso = (t) => new Date(t).toISOString();
    const states = [];
    const entities = {};
    const devices = {};
    const st = (entity_id, state, attributes, extra) => {
      states.push(Object.assign({ entity_id, state: String(state), attributes, last_changed: iso(now - 20 * 60000), last_updated: iso(now - 60000), last_reported: iso(now - 30000) }, extra || {}));
    };
    SENSORS.forEach((s) => {
      const dev = s.dev || 'dev_' + s.roomId;
      devices[dev] = s.dev
        ? { area_id: null, name: s.devName, manufacturer: null, model: null, entry_type: s.service ? 'service' : null }
        : { area_id: s.roomId, name: 'Klimaatsensor ' + s.roomId, manufacturer: 'Aqara', model: 'TH-01' };
      entities[s.id] = { area_id: null, device_id: dev, name: null, platform: s.platform || 'zha' };
      const v = round(sensorValueAt(s, now), dec[s.metric]);
      const extra = isStale(s) ?{ last_reported: iso(now - 9.5 * HOUR), last_updated: iso(now - 9.5 * HOUR), last_changed: iso(now - 9.5 * HOUR) } : null;
      st(s.id, v, { unit_of_measurement: s.unit, device_class: s.dc, state_class: 'measurement', friendly_name: s.name }, extra);
    });
    Object.keys(ROOMS).forEach((r, i) => {
      if (r === 'tuin') return;
      const b = 'sensor.' + r + '_battery';
      entities[b] = { area_id: null, device_id: 'dev_' + r, name: null };
      st(b, r === 'kinderkamer' ? 12 : 64 + ((i * 17) % 36), { unit_of_measurement: '%', device_class: 'battery', friendly_name: 'Klimaatsensor ' + r + ' Batterij' });
    });
    // thermostats
    [['woonkamer', 'Woonkamer Thermostaat', 21], ['slaapkamer', 'Slaapkamer Radiator', 18]].forEach(([r, name, target]) => {
      const id = 'climate.' + r;
      entities[id] = { area_id: r, device_id: null, name: null };
      const heating = heatingActive(r, now);
      st(id, 'heat', { friendly_name: name, current_temperature: round(value('temperature', r, now), 1), hvac_action: heating || r === 'woonkamer' ? 'heating' : 'idle', temperature: heating || r === 'woonkamer' ? target : target - 2, hvac_modes: ['off', 'heat'], preset_mode: heating || r === 'woonkamer' ? 'comfort' : 'eco' });
    });
    // openings
    entities['binary_sensor.slaapkamer_raam'] = { area_id: 'slaapkamer', device_id: null, name: null };
    st('binary_sensor.slaapkamer_raam', 'on', { device_class: 'window', friendly_name: 'Slaapkamer Raam' }, { last_changed: iso(now - 47 * 60000) });
    entities['binary_sensor.voordeur'] = { area_id: 'woonkamer', device_id: null, name: null };
    st('binary_sensor.voordeur', 'off', { device_class: 'door', friendly_name: 'Voordeur' });
    entities['binary_sensor.badkamer_raam'] = { area_id: 'badkamer', device_id: null, name: null };
    st('binary_sensor.badkamer_raam', 'off', { device_class: 'window', friendly_name: 'Badkamer Raam' });
    // lights & fans
    [['woonkamer', 'Woonkamer Plafond', 'on'], ['woonkamer', 'Woonkamer Leeslamp', 'on'], ['keuken', 'Keuken Spots', 'on'], ['slaapkamer', 'Slaapkamer Lamp', 'off'], ['werkkamer', 'Werkkamer Bureaulamp', 'on']].forEach(([r, name, s], i) => {
      const id = 'light.' + r + '_' + i;
      entities[id] = { area_id: r, device_id: null, name: null };
      st(id, s, { friendly_name: name, brightness: s === 'on' ? 180 : null });
    });
    entities['fan.badkamer_afzuiging'] = { area_id: 'badkamer', device_id: null, name: null };
    st('fan.badkamer_afzuiging', 'on', { friendly_name: 'Badkamer Afzuiging', percentage: 66 });
    // weather & sun
    st('weather.forecast_thuis', 'partlycloudy', { friendly_name: 'Thuis', temperature: round(outdoorTemp(now) + 0.3, 1), apparent_temperature: round(outdoorTemp(now) - 2.4, 1), humidity: 83, pressure: 1017.8, wind_speed: 14.4, wind_speed_unit: 'km/h', temperature_unit: '°C', pressure_unit: 'hPa' });
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    let rise = today.getTime() + 8.2 * HOUR;
    let set = today.getTime() + 16.8 * HOUR;
    const up = now > rise && now < set;
    if (now > rise) rise += DAY;
    if (now > set) set += DAY;
    const hNow = hourOf(now);
    st('sun.sun', up ? 'above_horizon' : 'below_horizon', { friendly_name: 'Zon', next_rising: iso(rise), next_setting: iso(set), elevation: round(up ? 17 * Math.sin((Math.PI * (hNow - 8.2)) / 8.6) : -12, 1), rising: hNow < 12.5 });

    boot = {
      demo: true,
      version: 'demo',
      connected: true,
      options: {
        language: 'auto', temperature_comfort_min: 19.5, temperature_comfort_max: 22.5, humidity_comfort_min: 40, humidity_comfort_max: 60,
        co2_warning: 1000, co2_critical: 1400, stale_sensor_hours: 6, low_battery_percent: 20, weather_entity: '', outdoor_temperature_entity: '', outdoor_humidity_entity: '', exclude_entities: []
      },
      config: { location_name: 'Thuis', language: navigator.language, time_zone: 'Europe/Amsterdam', unit_system: { temperature: '°C' } },
      areas: AREAS, floors: FLOORS, devices, entities, states
    };
    return withExcluded(JSON.parse(JSON.stringify(boot)));
  }
  function withExcluded(b) {
    b.options.exclude_entities = excluded.slice();
    return b;
  }

  /** Same shape as GET api/entities */
  async function entities() {
    const b = bootstrap();
    const areaOf = (eid) => {
      const e = b.entities[eid] || {};
      return e.area_id || ((b.devices[e.device_id] || {}).area_id) || null;
    };
    await new Promise((r) => setTimeout(r, 80));
    return {
      areas: b.areas.map((a) => ({ area_id: a.area_id, name: a.name })),
      entities: b.states.filter((s) => s.entity_id !== 'sun.sun').map((s) => ({
        entity_id: s.entity_id,
        state: s.state,
        attributes: { friendly_name: s.attributes.friendly_name, device_class: s.attributes.device_class, unit_of_measurement: s.attributes.unit_of_measurement, current_temperature: s.attributes.current_temperature },
        area_id: areaOf(s.entity_id),
        device: ((b.devices[(b.entities[s.entity_id] || {}).device_id]) || {}).name || null,
        platform: (b.entities[s.entity_id] || {}).platform || null,
        excluded_by: excluded.indexOf(s.entity_id) >= 0 ? 'app' : null
      }))
    };
  }
  async function saveExcluded(ids) {
    excluded = Array.from(new Set(ids)).sort();
    try { localStorage.setItem('climateplus.demo_excluded', JSON.stringify(excluded)); } catch (e) { /* private mode */ }
    await new Promise((r) => setTimeout(r, 150));
    return { ok: true, exclude_entities: excluded.slice() };
  }

  function seriesFor(id, t0, t1, n) {
    const [eid, attr] = id.split('|');
    const out = { t: [], v: [], mn: [], mx: [] };
    let roomId;
    let metric;
    let fn = null;
    const sensor = SENSORS.find((s) => s.id === eid);
    if (sensor) { roomId = sensor.roomId; metric = sensor.metric; fn = sensor.fn || null; }
    else if (eid.startsWith('climate.')) { roomId = eid.slice(8); metric = attr === 'current_humidity' ? 'humidity' : 'temperature'; }
    else if (eid.startsWith('weather.')) { roomId = 'tuin'; metric = 'temperature'; }
    else if (eid.startsWith('binary_sensor.')) {
      const seg = [];
      const d = new Date(t0); d.setHours(0, 0, 0, 0);
      for (let day = d.getTime(); day < t1; day += DAY) {
        const a = day + 7.4 * HOUR + hash(eid, day) * HOUR;
        if (a + 25 * 60000 > t0 && a < t1) seg.push([Math.max(a, t0), Math.min(a + 25 * 60000, t1), 'on']);
      }
      if (eid === 'binary_sensor.slaapkamer_raam') seg.push([Date.now() - 47 * 60000, t1, 'on']);
      return { seg };
    } else return out;
    const step = (t1 - t0) / n;
    const nowMs = Date.now();
    for (let i = 0; i < n; i++) {
      const tm = t0 + step * (i + 0.5);
      if (tm > nowMs) break;
      const samples = [0.1, 0.5, 0.9].map((f) => (fn ? fn(t0 + step * (i + f)) : value(metric, roomId, t0 + step * (i + f))));
      const v = samples.reduce((a, b) => a + b, 0) / samples.length;
      out.t.push(Math.round(tm));
      out.v.push(round(v, 2));
      out.mn.push(round(Math.min.apply(null, samples) - (step > HOUR ? Math.abs(v) * 0.03 : 0), 2));
      out.mx.push(round(Math.max.apply(null, samples) + (step > HOUR ? Math.abs(v) * 0.03 : 0), 2));
    }
    if (eid.startsWith('climate.')) {
      const seg = [];
      let start = null;
      const segStep = Math.max(5 * 60000, step);
      for (let tm = t0; tm <= Math.min(t1, nowMs); tm += segStep) {
        const on = heatingActive(roomId, tm);
        if (on && start == null) start = tm;
        if (!on && start != null) { seg.push([start, tm, 'heating']); start = null; }
      }
      if (start != null) seg.push([start, Math.min(t1, nowMs), 'heating']);
      out.seg = seg;
    }
    return out;
  }

  async function series(ids, q) {
    const end = q.end != null ? q.end : Date.now();
    const start = q.start != null ? q.start : end - (q.hours || 24) * HOUR;
    const span = end - start;
    let n = q.points || 288;
    let source = 'history';
    if (span > 7 * DAY) {
      n = span <= 35 * DAY ? Math.round(span / HOUR) : Math.round(span / DAY);
      source = span <= 35 * DAY ? 'statistics:hour' : 'statistics:day';
    }
    const result = {};
    ids.forEach((id) => {
      result[id] = seriesFor(id, start, end, n);
      result[id].source = source;
    });
    await new Promise((r) => setTimeout(r, 120));
    return { start, end, series: result };
  }

  async function forecast() {
    const out = [];
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    const conditions = ['partlycloudy', 'rainy', 'cloudy', 'sunny', 'rainy', 'partlycloudy', 'sunny'];
    for (let i = 0; i < 6; i++) {
      const t = d.getTime() + i * DAY;
      out.push({ datetime: new Date(t).toISOString(), condition: conditions[i], temperature: round(outdoorTemp(t + 3 * HOUR) + 1.5, 1), templow: round(outdoorTemp(t - 7 * HOUR) - 1, 1), precipitation: conditions[i] === 'rainy' ? 3.2 : 0 });
    }
    return { forecast: out };
  }

  function connect(onMessage) {
    setTimeout(() => onMessage({ type: 'status', connected: true }), 50);
    const timer = setInterval(() => {
      const now = Date.now();
      const pick = SENSORS.filter((s) => !isStale(s) && hash('tick', Math.floor(now / 5000) + s.id.length) < 0.6);
      pick.forEach((s) => {
        const state = boot.states.find((x) => x.entity_id === s.id);
        if (!state) return;
        const v = round(sensorValueAt(s, now), dec[s.metric]);
        state.state = String(v);
        state.last_updated = state.last_reported = new Date(now).toISOString();
        onMessage({ type: 'state', entity_id: s.id, state: JSON.parse(JSON.stringify(state)) });
      });
    }, 5000);
    return { close: () => clearInterval(timer) };
  }

  CP.demo = { bootstrap, series, forecast, connect, entities, saveExcluded };
})();
