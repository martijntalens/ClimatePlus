/* ClimatePlus — API client (ingress-relative URLs) with demo fallback */
(function () {
  'use strict';
  const CP = (window.CP = window.CP || {});
  const MAX_IDS = 60;

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    let body = {};
    try { body = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) {
      const err = new Error(body.error || res.status + ' ' + res.statusText);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  CP.api = {
    demo: /[?&]demo(=1|=true)?(&|$)/.test(location.search) || location.protocol === 'file:',

    async bootstrap() {
      if (this.demo) return CP.demo.bootstrap();
      const data = await getJson('api/bootstrap');
      if (data.demo) {
        this.demo = true;
        const demo = CP.demo.bootstrap();
        const hidden = demo.options.exclude_entities.concat((data.options && data.options.exclude_entities) || []);
        demo.options = Object.assign(demo.options, data.options, { exclude_entities: hidden });
        demo.version = data.version;
        return demo;
      }
      return data;
    },

    /** All climate entities including hidden ones: { entities:[{entity_id,state,attributes,area_id,device,platform,excluded_by}], areas } */
    async entities() {
      if (this.demo) return CP.demo.entities();
      return getJson('api/entities');
    },

    /** Store the entities hidden from the dashboard (kept by the app, not in Home Assistant). */
    async saveExcluded(ids) {
      if (this.demo) return CP.demo.saveExcluded(ids);
      const res = await fetch('api/settings', {
        method: 'PUT',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-ClimatePlus': '1' },
        body: JSON.stringify({ exclude_entities: ids })
      });
      let body = {};
      try { body = await res.json(); } catch (e) { /* ignore */ }
      if (!res.ok) throw new Error(body.error || res.status + ' ' + res.statusText);
      return body;
    },

    /** q: { hours | start,end (ms), points } → { start, end, series:{id:{t,v,mn,mx,seg}} } */
    async series(ids, q) {
      ids = Array.from(new Set(ids.filter(Boolean)));
      if (!ids.length) return { series: {} };
      if (this.demo) return CP.demo.series(ids, q);
      const chunks = [];
      for (let i = 0; i < ids.length; i += MAX_IDS) chunks.push(ids.slice(i, i + MAX_IDS));
      const results = await Promise.all(chunks.map((chunk) => {
        const p = new URLSearchParams({ ids: chunk.join(','), points: String(q.points || 288) });
        if (q.start != null) p.set('start', new Date(q.start).toISOString());
        if (q.end != null) p.set('end', new Date(q.end).toISOString());
        if (q.hours != null && q.start == null) p.set('hours', String(q.hours));
        return getJson('api/series?' + p.toString());
      }));
      const merged = { series: {} };
      results.forEach((r) => {
        merged.start = r.start;
        merged.end = r.end;
        Object.assign(merged.series, r.series || {});
      });
      return merged;
    },

    async forecast(entityId, type) {
      if (this.demo) return CP.demo.forecast(entityId, type);
      const p = new URLSearchParams({ entity_id: entityId, type: type || 'daily' });
      return getJson('api/forecast?' + p.toString());
    },

    /** Live updates; onMessage receives {type:'state'|'reload'|'status', ...} */
    connect(onMessage) {
      if (this.demo) return CP.demo.connect(onMessage);
      let delay = 1000;
      let ws;
      const open = () => {
        const url = new URL('api/ws', location.href);
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(url.toString());
        ws.onopen = () => { delay = 1000; };
        ws.onmessage = (ev) => {
          try { onMessage(JSON.parse(ev.data)); } catch (e) { console.warn('ClimatePlus: bad message', e); }
        };
        ws.onclose = () => {
          onMessage({ type: 'status', connected: false, socket: false });
          setTimeout(open, delay);
          delay = Math.min(delay * 2, 30000);
        };
      };
      open();
      return { close: () => ws && ws.close() };
    }
  };
})();
