/* ClimatePlus — climate model, physics, comfort scoring and insights */
(function () {
  'use strict';
  const CP = (window.CP = window.CP || {});
  const t = (k, v) => CP.t(k, v);

  /* ------------------------------------------------------------------ */
  /* Metrics                                                             */
  /* ------------------------------------------------------------------ */
  const METRICS = {
    temperature: { dec: 1, unit: '°C', icon: 'thermo', classes: ['temperature'] },
    humidity: { dec: 0, unit: '%', icon: 'drop', classes: ['humidity'] },
    co2: { dec: 0, unit: 'ppm', icon: 'wind', classes: ['carbon_dioxide'], air: true },
    voc: { dec: 0, unit: 'ppb', icon: 'wind', classes: ['volatile_organic_compounds', 'volatile_organic_compounds_parts'], air: true },
    pm25: { dec: 0, unit: 'µg/m³', icon: 'wind', classes: ['pm25'], air: true },
    pm10: { dec: 0, unit: 'µg/m³', icon: 'wind', classes: ['pm10'], air: true },
    pm1: { dec: 0, unit: 'µg/m³', icon: 'wind', classes: ['pm1'], air: true },
    co: { dec: 0, unit: 'ppm', icon: 'wind', classes: ['carbon_monoxide'], air: true },
    no2: { dec: 0, unit: 'µg/m³', icon: 'wind', classes: ['nitrogen_dioxide'], air: true },
    ozone: { dec: 0, unit: 'µg/m³', icon: 'wind', classes: ['ozone'], air: true },
    aqi: { dec: 0, unit: '', icon: 'wind', classes: ['aqi'], air: true },
    illuminance: { dec: 0, unit: 'lx', icon: 'sun', classes: ['illuminance'] },
    pressure: { dec: 0, unit: 'hPa', icon: 'gauge', classes: ['atmospheric_pressure', 'pressure'] },
    noise: { dec: 0, unit: 'dB', icon: 'sound', classes: ['sound_pressure'] }
  };
  const METRIC_ORDER = ['temperature', 'humidity', 'co2', 'voc', 'pm25', 'pm10', 'pm1', 'co', 'no2', 'ozone', 'aqi', 'illuminance', 'pressure', 'noise'];
  const CLASS_TO_METRIC = {};
  Object.keys(METRICS).forEach((m) => METRICS[m].classes.forEach((c) => (CLASS_TO_METRIC[c] = m)));
  const PRESSURE_UNITS = ['hPa', 'mbar', 'kPa', 'inHg', 'mmHg'];
  const OUTDOOR_RE = /(^|[\s_.-])(buiten|outdoor|outside|exterior|garden|tuin|achtertuin|voortuin|balkon|balcony|terras|terrace|patio|yard|dakterras)([\s_.-]|$)/i;
  // Integrations that report outdoor weather / outdoor air quality. Their sensors
  // without an area belong to "Outdoor", not to an indoor room.
  const WEATHER_PLATFORMS = new Set(['buienradar', 'met', 'met_eireann', 'openweathermap', 'accuweather', 'pirateweather', 'knmi', 'weatherflow', 'weatherflow_cloud', 'tomorrowio', 'meteo_france', 'metoffice', 'open_meteo', 'smhi', 'nws', 'environment_canada', 'ipma', 'aemet', 'bom', 'brightsky', 'weatherkit', 'google_weather', 'luchtmeetnet', 'waqi', 'airvisual', 'airly', 'airnow', 'openuv']);

  function classify(st) {
    const id = st.entity_id;
    const domain = id.split('.')[0];
    const a = st.attributes || {};
    const dc = a.device_class;
    const unit = a.unit_of_measurement;
    if (domain === 'climate') return { kind: 'thermostat' };
    if (domain === 'weather') return { kind: 'weather' };
    if (id === 'sun.sun') return { kind: 'sun' };
    if (domain === 'light' || domain === 'fan' || domain === 'humidifier') return { kind: domain };
    if (domain === 'binary_sensor') return { kind: 'opening', door: dc === 'door' || dc === 'garage_door' };
    if (domain !== 'sensor') return null;
    if (dc === 'battery') return { kind: 'battery' };
    let metric = CLASS_TO_METRIC[dc];
    if (!metric) {
      const key = (id + ' ' + (a.friendly_name || '')).toLowerCase();
      if (unit === '°C' || unit === '°F') metric = 'temperature';
      else if (unit === 'lx') metric = 'illuminance';
      else if (unit === 'hPa' || unit === 'mbar') metric = 'pressure';
      else if (unit === 'ppm') metric = /voc/.test(key) ? 'voc' : 'co2';
      else if (unit === 'ppb') metric = 'voc';
      else if (/µg|μg/.test(unit || '')) metric = /pm10/.test(key) ? 'pm10' : /pm1(?![05])/.test(key) ? 'pm1' : 'pm25';
    }
    if (!metric) return null;
    if (metric === 'pressure' && unit && PRESSURE_UNITS.indexOf(unit) < 0) return null; // e.g. boiler pressure in bar
    if (metric === 'humidity' && unit && unit !== '%') return null;
    return { kind: 'sensor', metric };
  }

  /* ------------------------------------------------------------------ */
  /* Values & physics                                                    */
  /* ------------------------------------------------------------------ */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  }

  /** Normalise a raw value to internal units (°C, hPa). */
  function normalise(metric, value, unit) {
    const v = num(value);
    if (v === null) return null;
    if (metric === 'temperature' && unit === '°F') return (v - 32) * 5 / 9;
    if (metric === 'pressure') {
      if (unit === 'kPa') return v * 10;
      if (unit === 'inHg') return v * 33.8639;
      if (unit === 'mmHg') return v * 1.33322;
    }
    return v;
  }

  function sensorValue(st, metric) {
    if (!st) return null;
    return normalise(metric, st.state, (st.attributes || {}).unit_of_measurement);
  }

  const psat = (T) => 6.112 * Math.exp((17.62 * T) / (243.12 + T)); // hPa
  function dewPoint(T, RH) {
    if (T == null || RH == null || RH <= 0) return null;
    const g = Math.log(RH / 100) + (17.62 * T) / (243.12 + T);
    return (243.12 * g) / (17.62 - g);
  }
  function absHumidity(T, RH) {
    if (T == null || RH == null) return null;
    return (216.7 * ((RH / 100) * psat(T))) / (273.15 + T); // g/m³
  }
  /** Estimated RH at the coldest spot of an outer wall (fRsi temperature factor). */
  function surfaceRH(Ti, RH, To, fRsi) {
    if (Ti == null || RH == null || To == null || To >= Ti) return null;
    const Ts = To + (fRsi || 0.7) * (Ti - To);
    return Math.min(100, (RH * psat(Ti)) / psat(Ts));
  }

  /* ------------------------------------------------------------------ */
  /* Comfort scoring                                                     */
  /* ------------------------------------------------------------------ */
  function rangeScore(v, lo, hi, perUnit) {
    if (v == null) return null;
    if (v >= lo && v <= hi) return 100;
    const d = v < lo ? lo - v : v - hi;
    return Math.max(0, Math.round(100 - d * perUnit));
  }
  function stepScore(v, good, warn, crit, zero) {
    if (v == null) return null;
    if (v <= good) return 100;
    if (v <= warn) return Math.round(100 - (30 * (v - good)) / (warn - good));
    if (v <= crit) return Math.round(70 - (40 * (v - warn)) / (crit - warn));
    return Math.max(0, Math.round(30 - (30 * (v - crit)) / (zero - crit)));
  }
  function airScores(values, opts) {
    const s = {};
    if (values.co2 != null) s.co2 = stepScore(values.co2, 600, opts.co2_warning, opts.co2_critical, opts.co2_critical + 800);
    if (values.pm25 != null) s.pm25 = stepScore(values.pm25, 5, 15, 35, 75);
    if (values.pm10 != null) s.pm10 = stepScore(values.pm10, 15, 45, 75, 150);
    if (values.voc != null && values.vocUnit === 'ppb') s.voc = stepScore(values.voc, 220, 660, 2200, 5500);
    if (values.co != null) s.co = stepScore(values.co, 2, 9, 35, 100);
    return s;
  }
  function scoreLabel(score) {
    if (score == null) return { key: 'na', label: t('score.na'), level: 'na' };
    if (score >= 85) return { key: 'excellent', label: t('score.excellent'), level: 'good' };
    if (score >= 70) return { key: 'good', label: t('score.good'), level: 'good' };
    if (score >= 50) return { key: 'fair', label: t('score.fair'), level: 'warning' };
    return { key: 'poor', label: t('score.poor'), level: 'critical' };
  }

  /* ------------------------------------------------------------------ */
  /* Model                                                               */
  /* ------------------------------------------------------------------ */
  function buildModel(boot) {
    const opts = boot.options || {};
    const config = boot.config || {};
    const states = {};
    (boot.states || []).forEach((s) => (states[s.entity_id] = s));
    const areas = {};
    (boot.areas || []).forEach((a) => (areas[a.area_id] = a));
    const floors = {};
    (boot.floors || []).forEach((f) => (floors[f.floor_id] = f));
    const registry = boot.entities || {};
    const devices = boot.devices || {};
    const excluded = new Set(opts.exclude_entities || []);

    const rooms = {};
    const entities = {};
    const weathers = [];
    let sun = null;

    function room(id) {
      if (!rooms[id]) {
        const area = areas[id];
        const name = area ? area.name : id === '_outdoor' ? t('outdoor') : t('unassigned');
        rooms[id] = {
          id,
          name,
          area,
          floorId: area ? area.floor_id : null,
          outdoor: id === '_outdoor' || (!!area && OUTDOOR_RE.test(area.name)),
          sensors: {},
          thermostats: [],
          openings: [],
          lights: [],
          fans: [],
          humidifiers: [],
          batteries: [],
          primary: {}
        };
      }
      return rooms[id];
    }

    // devices that also expose a weather entity are weather services
    const weatherDevices = new Set();
    Object.keys(states).forEach((eid) => {
      if (eid.startsWith('weather.') && registry[eid] && registry[eid].device_id) weatherDevices.add(registry[eid].device_id);
    });
    const isWeatherSource = (reg, dev) =>
      WEATHER_PLATFORMS.has(reg.platform) || dev.entry_type === 'service' || (reg.device_id != null && weatherDevices.has(reg.device_id));

    Object.keys(states).forEach((eid) => {
      if (excluded.has(eid)) return;
      const st = states[eid];
      const c = classify(st);
      if (!c) return;
      if (c.kind === 'weather') { weathers.push(eid); return; }
      if (c.kind === 'sun') { sun = eid; return; }
      const reg = registry[eid] || {};
      const dev = devices[reg.device_id] || {};
      let roomId = reg.area_id || dev.area_id || null;
      const fname = (st.attributes && st.attributes.friendly_name) || eid;
      if (eid === opts.outdoor_temperature_entity || eid === opts.outdoor_humidity_entity) roomId = roomId && areas[roomId] && OUTDOOR_RE.test(areas[roomId].name) ? roomId : '_outdoor';
      if (!roomId) roomId = OUTDOOR_RE.test(fname + ' ' + eid) || (c.kind === 'sensor' && isWeatherSource(reg, dev)) ? '_outdoor' : '_none';
      const r = room(roomId);
      entities[eid] = { id: eid, kind: c.kind, metric: c.metric, door: !!c.door, roomId, deviceId: reg.device_id || null, device: dev };
      if (c.kind === 'sensor') (r.sensors[c.metric] = r.sensors[c.metric] || []).push(eid);
      else if (c.kind === 'thermostat') r.thermostats.push(eid);
      else if (c.kind === 'opening') r.openings.push(eid);
      else if (c.kind === 'light') r.lights.push(eid);
      else if (c.kind === 'fan') r.fans.push(eid);
      else if (c.kind === 'humidifier') r.humidifiers.push(eid);
      else if (c.kind === 'battery') r.batteries.push(eid);
    });

    // Primary sensors per room (area settings win, otherwise first by id)
    Object.values(rooms).forEach((r) => {
      Object.keys(r.sensors).forEach((m) => r.sensors[m].sort());
      const a = r.area || {};
      ['temperature', 'humidity'].forEach((m) => {
        const pref = a[m + '_entity_id'];
        if (pref && entities[pref] && entities[pref].metric === m) r.primary[m] = pref;
        else if (r.sensors[m]) r.primary[m] = r.sensors[m][0];
        else if (r.thermostats.length) {
          const attr = m === 'temperature' ? 'current_temperature' : 'current_humidity';
          const th = r.thermostats.find((e) => num(states[e].attributes && states[e].attributes[attr]) !== null);
          if (th) r.primary[m] = th + '|' + attr;
        }
      });
      Object.keys(r.sensors).forEach((m) => { if (!r.primary[m]) r.primary[m] = r.sensors[m][0]; });
    });

    const isClimateRoom = (r) => Object.keys(r.sensors).length > 0 || r.thermostats.length > 0;
    const floorLevel = (r) => {
      const f = floors[r.floorId];
      return f && f.level != null ? f.level : 999;
    };
    // Entities without an area are listed separately: averaging unrelated sensors
    // (a phone, a NAS, a weather service) would distort the house figures.
    const unassigned = rooms._none || null;
    const all = Object.values(rooms).filter((r) => r.id !== '_none' && isClimateRoom(r));
    const indoor = all
      .filter((r) => !r.outdoor)
      .sort((a, b) => floorLevel(a) - floorLevel(b) || a.name.localeCompare(b.name));
    const outdoor = all.filter((r) => r.outdoor).sort((a, b) => (a.id === '_outdoor') - (b.id === '_outdoor') || a.name.localeCompare(b.name));
    indoor.forEach((r, i) => (r.slot = i)); // stable colour slot follows the room

    let weather = opts.weather_entity && states[opts.weather_entity] ? opts.weather_entity : null;
    if (!weather) weather = weathers.find((w) => /home|forecast|thuis/.test(w)) || weathers[0] || null;

    return {
      opts,
      config,
      states,
      rooms,
      roomList: indoor,
      outdoorRooms: outdoor,
      unassigned,
      entities,
      floors,
      weather,
      sun,
      allLights: Object.keys(entities).filter((e) => entities[e].kind === 'light'),
      tempUnit: (config.unit_system && config.unit_system.temperature) === '°F' ? '°F' : '°C'
    };
  }

  function avg(list) {
    const v = list.filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  function metricUnitOf(model, eids) {
    const st = eids && eids.length ? model.states[eids[0]] : null;
    return st && st.attributes ? st.attributes.unit_of_measurement : undefined;
  }

  function roomValues(model, r) {
    const values = {};
    Object.keys(r.sensors).forEach((m) => {
      values[m] = avg(r.sensors[m].map((e) => sensorValue(model.states[e], m)));
    });
    // Fall back to thermostat readings
    if (values.temperature == null && r.thermostats.length) {
      values.temperature = avg(r.thermostats.map((e) => normalise('temperature', (model.states[e].attributes || {}).current_temperature, model.tempUnit)));
    }
    if (values.humidity == null && r.thermostats.length) {
      values.humidity = avg(r.thermostats.map((e) => num((model.states[e].attributes || {}).current_humidity)));
    }
    if (values.voc != null) values.vocUnit = metricUnitOf(model, r.sensors.voc);
    return values;
  }

  function thermostatInfo(model, eid) {
    const st = model.states[eid];
    const a = (st && st.attributes) || {};
    return {
      id: eid,
      name: displayName(model, eid),
      mode: st ? st.state : 'unavailable',
      action: a.hvac_action || null,
      current: normalise('temperature', a.current_temperature, model.tempUnit),
      target: normalise('temperature', a.temperature != null ? a.temperature : a.target_temp_low, model.tempUnit),
      preset: a.preset_mode || null
    };
  }

  /** Evaluate the live model: per-room values, derived physics, scores and house aggregates. */
  function evaluate(model) {
    const o = model.opts;
    const outdoor = outdoorValues(model);
    const rooms = model.roomList.map((r) => {
      const values = roomValues(model, r);
      const T = values.temperature;
      const RH = values.humidity;
      const parts = {
        temperature: rangeScore(T, o.temperature_comfort_min, o.temperature_comfort_max, 22),
        humidity: rangeScore(RH, o.humidity_comfort_min, o.humidity_comfort_max, 4)
      };
      const air = airScores(values, o);
      const airKeys = Object.keys(air);
      parts.air = airKeys.length ? Math.min.apply(null, airKeys.map((k) => air[k])) : null;
      const weights = { temperature: 0.4, humidity: 0.25, air: 0.35 };
      let wsum = 0;
      let ssum = 0;
      let worst = 100;
      Object.keys(parts).forEach((k) => {
        if (parts[k] != null) { wsum += weights[k]; ssum += weights[k] * parts[k]; worst = Math.min(worst, parts[k]); }
      });
      const srh = surfaceRH(T, RH, outdoor.temperature, 0.7);
      let mold = 'low';
      if ((srh != null && srh >= 80) || (RH != null && RH >= 75)) mold = 'high';
      else if ((srh != null && srh >= 70) || (RH != null && RH >= 65)) mold = 'elevated';
      // one bad aspect should not be hidden by good averages
      let score = wsum ? Math.min(Math.round(ssum / wsum), worst + 25) : null;
      if (score != null && RH != null && mold === 'high') score = Math.min(score, 65);
      else if (score != null && RH != null && mold === 'elevated') score = Math.min(score, 80);
      const thermostats = r.thermostats.map((e) => thermostatInfo(model, e));
      const openOpenings = r.openings.filter((e) => model.states[e] && model.states[e].state === 'on');
      const lightsOn = r.lights.filter((e) => model.states[e] && model.states[e].state === 'on');
      return {
        room: r,
        values,
        score,
        parts,
        air,
        dew: dewPoint(T, RH),
        ah: absHumidity(T, RH),
        srh,
        mold: RH == null ? null : mold,
        thermostats,
        heating: thermostats.some((th) => th.action === 'heating' || th.action === 'preheating'),
        openOpenings,
        lightsOn
      };
    });

    const withT = rooms.filter((x) => x.values.temperature != null);
    const withH = rooms.filter((x) => x.values.humidity != null);
    const withCO2 = rooms.filter((x) => x.values.co2 != null);
    const withLux = rooms.filter((x) => x.values.illuminance != null);
    const scored = rooms.filter((x) => x.score != null);
    const by = (list, m, dir) => list.slice().sort((a, b) => dir * (a.values[m] - b.values[m]))[0] || null;
    const lightsOn = model.allLights.filter((e) => model.states[e] && model.states[e].state === 'on');
    const openings = [];
    model.roomList.concat(model.outdoorRooms, model.unassigned ? [model.unassigned] : []).forEach((r) => r.openings.forEach((e) => { if (model.states[e] && model.states[e].state === 'on') openings.push(e); }));

    const house = {
      temperature: avg(withT.map((x) => x.values.temperature)),
      humidity: avg(withH.map((x) => x.values.humidity)),
      score: scored.length ? Math.round(avg(scored.map((x) => x.score))) : null,
      scoredRooms: scored.length,
      warmest: by(withT, 'temperature', -1),
      coldest: by(withT, 'temperature', 1),
      mostHumid: by(withH, 'humidity', -1),
      worstCO2: by(withCO2, 'co2', -1),
      lux: avg(withLux.map((x) => x.values.illuminance)),
      lightsOn,
      openings,
      heating: rooms.filter((x) => x.heating)
    };
    house.dew = dewPoint(house.temperature, house.humidity);
    house.ah = absHumidity(house.temperature, house.humidity);

    const result = { rooms, house, outdoor, sun: sunInfo(model), unassigned: unassignedInfo(model) };
    result.insights = insights(model, result);
    return result;
  }

  /** Entities without an area: listed one by one, never averaged or scored. */
  function unassignedInfo(model) {
    const r = model.unassigned;
    if (!r) return null;
    const sensors = [];
    METRIC_ORDER.forEach((m) => (r.sensors[m] || []).forEach((id) => {
      const e = model.entities[id];
      sensors.push({ id, metric: m, value: sensorValue(model.states[id], m), device: (e && e.device && e.device.name) || null });
    }));
    const thermostats = r.thermostats.map((e) => thermostatInfo(model, e));
    const others = r.openings.length + r.lights.length + r.fans.length + r.humidifiers.length;
    if (!sensors.length && !thermostats.length && !others) return null;
    return {
      room: r,
      sensors,
      thermostats,
      openOpenings: r.openings.filter((e) => model.states[e] && model.states[e].state === 'on'),
      lightsOn: r.lights.filter((e) => model.states[e] && model.states[e].state === 'on'),
      count: sensors.length + thermostats.length + others
    };
  }

  function outdoorValues(model) {
    const o = model.opts;
    const s = model.states;
    const w = model.weather ? s[model.weather] : null;
    const wa = (w && w.attributes) || {};
    const fromRooms = (m) => avg(model.outdoorRooms.map((r) => avg((r.sensors[m] || []).map((e) => sensorValue(s[e], m)))));
    let temperature = o.outdoor_temperature_entity ? sensorValue(s[o.outdoor_temperature_entity], 'temperature') : null;
    if (temperature == null) temperature = fromRooms('temperature');
    let tempSource = temperature != null ? (o.outdoor_temperature_entity || 'sensor') : null;
    if (temperature == null && w) {
      temperature = normalise('temperature', wa.temperature, wa.temperature_unit || model.tempUnit);
      tempSource = model.weather;
    }
    let humidity = o.outdoor_humidity_entity ? sensorValue(s[o.outdoor_humidity_entity], 'humidity') : null;
    if (humidity == null) humidity = fromRooms('humidity');
    if (humidity == null && w) humidity = num(wa.humidity);
    const pressure = fromRooms('pressure') != null ? fromRooms('pressure') : normalise('pressure', wa.pressure, wa.pressure_unit || 'hPa');
    return {
      temperature,
      humidity,
      pressure,
      illuminance: fromRooms('illuminance'),
      apparent: normalise('temperature', wa.apparent_temperature, wa.temperature_unit || model.tempUnit),
      wind: num(wa.wind_speed),
      windUnit: wa.wind_speed_unit || 'km/h',
      condition: w ? w.state : null,
      dew: dewPoint(temperature, humidity),
      ah: absHumidity(temperature, humidity),
      tempSource,
      available: temperature != null || humidity != null
    };
  }

  function sunInfo(model) {
    const st = model.sun ? model.states[model.sun] : null;
    if (!st) return null;
    const a = st.attributes || {};
    return {
      up: st.state === 'above_horizon',
      elevation: num(a.elevation),
      rising: a.rising,
      nextRising: a.next_rising ? new Date(a.next_rising) : null,
      nextSetting: a.next_setting ? new Date(a.next_setting) : null
    };
  }

  /* ------------------------------------------------------------------ */
  /* Insights                                                            */
  /* ------------------------------------------------------------------ */
  function insights(model, ev) {
    const o = model.opts;
    const out = [];
    const F = CP.fmt;
    const add = (level, icon, key, vars, roomId) => out.push({ level, icon, title: t('ins.' + key + '.t', vars), text: t('ins.' + key + '.d', vars), roomId });
    const now = Date.now();
    const outT = ev.outdoor.temperature;

    // Windows open while heating (open for more than 10 minutes)
    const heatingAny = ev.house.heating;
    ev.rooms.forEach((x) => {
      if (!heatingAny.length) return;
      x.openOpenings.forEach((e) => {
        const info = model.entities[e];
        if (info.door) return;
        const st = model.states[e];
        if (now - new Date(st.last_changed).getTime() < 10 * 60 * 1000) return;
        const th = x.heating ? x.thermostats.find((h) => h.action === 'heating' || h.action === 'preheating') : heatingAny[0].thermostats.find((h) => h.action === 'heating' || h.action === 'preheating');
        add('critical', 'window', 'window_heating', { room: x.room.name, window: displayName(model, e), thermostat: th ? th.name : '' }, x.room.id);
      });
    });

    ev.rooms.forEach((x) => {
      const v = x.values;
      const name = x.room.name;
      if (v.co2 != null && v.co2 >= o.co2_critical) add('critical', 'wind', 'co2_critical', { room: name, v: F.metric('co2', v.co2, model), limit: F.metric('co2', o.co2_critical, model) }, x.room.id);
      else if (v.co2 != null && v.co2 >= o.co2_warning) add('warning', 'wind', 'co2_high', { room: name, v: F.metric('co2', v.co2, model) }, x.room.id);

      if (v.humidity != null && v.humidity > o.humidity_comfort_max) {
        const vars = { room: name, rh: F.metric('humidity', v.humidity, model), max: F.metric('humidity', o.humidity_comfort_max, model) };
        if (ev.outdoor.ah != null && x.ah != null) {
          vars.out = F.num(ev.outdoor.ah, 1) + ' g/m³';
          vars.in = F.num(x.ah, 1) + ' g/m³';
          if (ev.outdoor.ah < x.ah - 1) add('info', 'drop', 'humid_vent', vars, x.room.id);
          else add('warning', 'drop', 'humid_novent', vars, x.room.id);
        } else add('warning', 'drop', 'humid', vars, x.room.id);
      } else if (v.humidity != null && v.humidity < Math.min(35, o.humidity_comfort_min)) {
        add('info', 'drop', 'dry', { room: name, rh: F.metric('humidity', v.humidity, model) }, x.room.id);
      }
      if (x.mold === 'high') {
        add('warning', 'spore', 'mold', { room: name, out: F.temp(outT, model), srh: x.srh != null ? F.num(x.srh, 0) + '%' : F.metric('humidity', v.humidity, model) }, x.room.id);
      }
      if (v.temperature != null && v.temperature < o.temperature_comfort_min - 2) add('warning', 'snow', 'cold', { room: name, v: F.temp(v.temperature, model), min: F.temp(o.temperature_comfort_min, model) }, x.room.id);
      else if (v.temperature != null && v.temperature > o.temperature_comfort_max + 2) add('warning', 'flame', 'warm', { room: name, v: F.temp(v.temperature, model), max: F.temp(o.temperature_comfort_max, model) }, x.room.id);
    });

    const inT = ev.house.temperature;
    if (inT != null && outT != null) {
      if (inT > o.temperature_comfort_max && outT < inT - 2 && outT > 10) add('info', 'window', 'cool_window', { out: F.temp(outT, model), in: F.temp(inT, model) });
      else if (inT > o.temperature_comfort_max - 0.5 && outT > inT + 1) add('info', 'sun', 'keep_closed', { out: F.temp(outT, model), in: F.temp(inT, model) });
    }
    if (outT != null && outT <= 0) add('info', 'snow', 'frost', { out: F.temp(outT, model) });
    if (ev.house.warmest && ev.house.coldest && ev.house.warmest !== ev.house.coldest) {
      const d = ev.house.warmest.values.temperature - ev.house.coldest.values.temperature;
      if (d >= 5) add('info', 'thermo', 'spread', { warm: ev.house.warmest.room.name, cold: ev.house.coldest.room.name, d: F.num(d * (model.tempUnit === '°F' ? 1.8 : 1), 1) + '°' });
    }

    // Sensor health
    const health = sensorHealth(model);
    const names = (list) => {
      const shown = list.slice(0, 3).map((h) => displayName(model, h.id));
      return shown.join(', ') + (list.length > 3 ? ' ' + t('and_more', { n: list.length - 3 }) : '');
    };
    const unavailable = health.filter((h) => h.status === 'unavailable');
    const stale = health.filter((h) => h.status === 'stale');
    const lowBat = health.filter((h) => h.lowBattery);
    if (unavailable.length) add('warning', 'radio', 'unavailable', { names: names(unavailable) });
    if (stale.length) add('warning', 'clock', 'stale', { names: names(stale), h: o.stale_sensor_hours });
    if (lowBat.length) {
      const devNames = lowBat.slice(0, 3).map((h) => ((h.entity.device && h.entity.device.name) || displayName(model, h.id)) + ' (' + F.num(h.battery, 0) + '%)');
      add('warning', 'battery', 'battery', { names: devNames.join(', ') + (lowBat.length > 3 ? ' ' + t('and_more', { n: lowBat.length - 3 }) : '') });
    }
    if (ev.unassigned && ev.unassigned.sensors.length) {
      add('info', 'list', 'unassigned', { n: ev.unassigned.sensors.length }, '_none');
    }

    const order = { critical: 0, warning: 1, info: 2, good: 3 };
    out.sort((a, b) => order[a.level] - order[b.level]);
    const climateIssues = out.filter((i) => i.level === 'critical' || (i.level === 'warning' && ['radio', 'clock', 'battery'].indexOf(i.icon) < 0));
    if (!climateIssues.length && ev.rooms.length) {
      const allIn = ev.rooms.every((x) => x.parts.temperature == null || x.parts.temperature === 100);
      if (allIn) out.unshift({ level: 'good', icon: 'leaf', title: t('ins.good.t'), text: t('ins.good.d') });
    }
    return out;
  }

  /** Per-sensor health: unavailable, stale, battery. */
  function sensorHealth(model) {
    const o = model.opts;
    const now = Date.now();
    const staleMs = (o.stale_sensor_hours || 6) * 3600 * 1000;
    const batteryByDevice = {};
    Object.values(model.entities).forEach((e) => {
      if (e.kind === 'battery' && e.deviceId) batteryByDevice[e.deviceId] = num(model.states[e.id] && model.states[e.id].state);
    });
    const list = [];
    Object.values(model.entities).forEach((e) => {
      if (e.kind !== 'sensor' && e.kind !== 'opening' && e.kind !== 'thermostat') return;
      const st = model.states[e.id];
      if (!st) return;
      const reported = new Date(st.last_reported || st.last_updated || st.last_changed).getTime();
      let status = 'ok';
      if (st.state === 'unavailable' || st.state === 'unknown') status = 'unavailable';
      else if (e.kind === 'sensor' && now - reported > staleMs) status = 'stale';
      const battery = e.deviceId != null && batteryByDevice[e.deviceId] != null ? batteryByDevice[e.deviceId] : null;
      list.push({ id: e.id, entity: e, status, reported, battery, lowBattery: battery != null && battery < (o.low_battery_percent || 20) });
    });
    // one battery warning per device
    const seen = new Set();
    list.forEach((h) => {
      if (!h.lowBattery) return;
      if (seen.has(h.entity.deviceId)) h.lowBattery = false;
      else seen.add(h.entity.deviceId);
    });
    return list;
  }

  /* ------------------------------------------------------------------ */
  /* Names & formatting                                                  */
  /* ------------------------------------------------------------------ */
  function displayName(model, eid) {
    const id = eid.split('|')[0];
    const st = model.states[id];
    return (st && st.attributes && st.attributes.friendly_name) || id;
  }
  /** Friendly name without the room prefix ("Woonkamer Temperatuur" → "Temperatuur"). */
  function shortName(model, eid, roomName) {
    const full = displayName(model, eid);
    if (roomName && full.toLowerCase().startsWith(roomName.toLowerCase() + ' ')) {
      const rest = full.slice(roomName.length + 1).trim();
      if (rest) return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return full;
  }

  const nfCache = {};
  function nf(dec) {
    const key = CP.i18n.locale + dec;
    if (!nfCache[key]) nfCache[key] = new Intl.NumberFormat(CP.i18n.locale, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return nfCache[key];
  }
  const fmt = {
    num(v, dec) {
      if (v == null || !isFinite(v)) return '–';
      const p = Math.pow(10, dec || 0);
      const r = Math.round(v * p) / p;
      return nf(dec || 0).format(r === 0 ? 0 : r); // avoid "-0"
    },
    /** temperature in display unit from internal °C */
    toDisplayTemp(c, model) {
      return c == null ? null : model && model.tempUnit === '°F' ? c * 9 / 5 + 32 : c;
    },
    temp(c, model, dec) {
      if (c == null) return '–';
      return fmt.num(fmt.toDisplayTemp(c, model), dec == null ? 1 : dec) + (model && model.tempUnit === '°F' ? '°F' : '°C');
    },
    unit(metric, model) {
      if (metric === 'temperature') return model && model.tempUnit === '°F' ? '°F' : '°C';
      return METRICS[metric] ? METRICS[metric].unit : '';
    },
    metric(metric, v, model, withUnit) {
      if (v == null) return '–';
      if (metric === 'temperature') return fmt.temp(v, model);
      const m = METRICS[metric] || { dec: 1, unit: '' };
      const u = fmt.unit(metric, model);
      return fmt.num(v, m.dec) + (withUnit === false || !u ? '' : (u === '%' ? '%' : ' ' + u));
    },
    time(d) {
      return new Intl.DateTimeFormat(CP.i18n.locale, { hour: '2-digit', minute: '2-digit' }).format(d);
    },
    dateTime(d, long) {
      const o = long ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      return new Intl.DateTimeFormat(CP.i18n.locale, o).format(d);
    },
    date(d, opts) {
      return new Intl.DateTimeFormat(CP.i18n.locale, opts || { day: 'numeric', month: 'short' }).format(d);
    },
    ago(ms) {
      const s = Math.max(0, (Date.now() - ms) / 1000);
      if (s < 90) return t('ago.now');
      if (s < 3600) return t('ago.min', { n: Math.round(s / 60) });
      if (s < 86400 * 2) return t('ago.hour', { n: Math.round(s / 3600) });
      return t('ago.day', { n: Math.round(s / 86400) });
    }
  };

  /* ------------------------------------------------------------------ */
  /* Colour scales (data colours, never used for text)                   */
  /* ------------------------------------------------------------------ */
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, f) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const c = A.map((x, i) => Math.round(x + (B[i] - x) * f));
    return 'rgb(' + c.join(',') + ')';
  }
  function interpolate(stops, v) {
    if (v == null) return null;
    if (v <= stops[0][0]) return mix(stops[0][1], stops[0][1], 0);
    for (let i = 1; i < stops.length; i++) {
      if (v <= stops[i][0]) {
        const f = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return mix(stops[i - 1][1], stops[i][1], f);
      }
    }
    return mix(stops[stops.length - 1][1], stops[stops.length - 1][1], 0);
  }
  const scales = {
    temperature(v, o) {
      const lo = o.temperature_comfort_min;
      const hi = o.temperature_comfort_max;
      return interpolate([[lo - 5, '#2a78d6'], [lo - 1.5, '#5598e7'], [(lo + hi) / 2, '#1baf7a'], [hi + 1.5, '#eda100'], [hi + 4, '#e34948']], v);
    },
    humidity(v, o) {
      return interpolate([[o.humidity_comfort_min - 15, '#eb6834'], [o.humidity_comfort_min, '#eda100'], [(o.humidity_comfort_min + o.humidity_comfort_max) / 2, '#1baf7a'], [o.humidity_comfort_max, '#5598e7'], [o.humidity_comfort_max + 15, '#1c5cab']], v);
    },
    co2(v, o) {
      return interpolate([[500, '#1baf7a'], [o.co2_warning, '#eda100'], [o.co2_critical, '#e34948']], v);
    },
    score(v) {
      return interpolate([[40, '#d03b3b'], [60, '#ec835a'], [75, '#fab219'], [90, '#0ca30c']], v);
    },
    /** diverging blue ↔ neutral ↔ red around `mid` */
    diverging(v, mid, spread, dark) {
      const neutral = dark ? '#383835' : '#f0efec';
      const f = Math.max(-1, Math.min(1, (v - mid) / spread));
      return f < 0 ? mix(neutral, dark ? '#3987e5' : '#2a78d6', -f) : mix(neutral, dark ? '#e66767' : '#e34948', f);
    },
    /** sequential blue ramp, low values recede into the surface */
    sequential(f, dark) {
      const ramp = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
      const r = dark ? ramp.slice().reverse() : ramp;
      const x = Math.max(0, Math.min(1, f)) * (r.length - 1);
      const i = Math.min(r.length - 2, Math.floor(x));
      return mix(r[i], r[i + 1], x - i);
    }
  };

  CP.climate = {
    METRICS,
    METRIC_ORDER,
    classify,
    buildModel,
    evaluate,
    sensorHealth,
    normalise,
    sensorValue,
    dewPoint,
    absHumidity,
    surfaceRH,
    scoreLabel,
    displayName,
    shortName,
    thermostatInfo,
    scales,
    num
  };
  CP.fmt = fmt;
})();
