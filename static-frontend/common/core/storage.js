/*
 * AppStorage - where the static copy keeps its state: the signed-in session, the simulated database and the
 * small "remembered" lists (same keys as the Angular app, all starting with "aroundu.").
 *
 * The pages live in different folders (customer/commerce, retailer, admin ...). Opened straight from disk
 * (file://), some browsers give every folder - or every file - its own localStorage, or block it altogether,
 * so a session saved by the login page would be invisible to the dashboard it opens (Firefox, for example, gives
 * every file opened from disk its own storage). Therefore every change is kept in three places, and the newest copy
 * wins when a page loads:
 *   1. localStorage, when the browser allows it (survives closing the tab);
 *   2. the tab's window.name, which most browsers keep from page to page in a tab;
 *   3. the address of the page being opened (#aroundu-state=...): the session and the other small values, plus the
 *      changes made to the simulated database (compared with the hardcoded data every page has). The page removes
 *      it from the address bar as soon as it has read it.
 *
 *   AppStorage.getItem(key) / setItem(key, value) / removeItem(key)   - the localStorage API
 *   AppStorage.handoff(url)                                            - url + the state hash (used by Nav)
 *   AppStorage.registerBase(key, fn)                                   - the hardcoded starting value of a key
 */
(function () {
  'use strict';

  const PREFIX = 'aroundu.';
  const REV_KEY = 'aroundu.rev';
  const DB_KEY = 'aroundu.static.db';
  const TAB_MARK = 'aroundu-state:';
  const HASH_KEY = 'aroundu-state';
  const bases = {}; // key -> () => JSON of the hardcoded starting value
  const pending = {}; // key -> changes received in the address, applied once the base is known

  function localStore() {
    try {
      const s = window.localStorage;
      s.getItem(REV_KEY);
      return s;
    } catch (e) {
      return null; // blocked (sandboxed preview, privacy settings)
    }
  }
  const local = localStore();

  function readLocal() {
    const items = {};
    if (!local) return { rev: 0, items };
    try {
      for (let i = 0; i < local.length; i++) {
        const k = local.key(i);
        if (k && k.startsWith(PREFIX) && k !== REV_KEY) items[k] = local.getItem(k);
      }
      return { rev: Number(local.getItem(REV_KEY)) || 0, items };
    } catch (e) {
      return { rev: 0, items: {} };
    }
  }
  function readTab() {
    try {
      if (typeof window.name === 'string' && window.name.startsWith(TAB_MARK)) {
        const t = JSON.parse(window.name.slice(TAB_MARK.length));
        if (t && typeof t.rev === 'number' && t.items && typeof t.items === 'object') return t;
      }
    } catch (e) { /* not ours */ }
    return { rev: 0, items: {} };
  }
  function readHash() {
    const m = new RegExp('(?:^#|&)' + HASH_KEY + '=([^&]*)').exec(window.location.hash || '');
    if (!m) return null;
    try {
      const h = JSON.parse(decodeURIComponent(m[1]));
      return h && typeof h.rev === 'number' ? h : null;
    } catch (e) {
      return null;
    }
  }

  /* ---- changes of a JSON value compared with a base value ({'=': value} / array / object nodes) */
  function diff(a, b) {
    if (a === b) return undefined;
    const arrays = Array.isArray(a) && Array.isArray(b);
    const objects = !arrays && a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b);
    if (!arrays && !objects) return { '=': b };
    const d = arrays ? { '#': 'a', n: b.length, c: {} } : { '#': 'o', c: {}, r: [] };
    let changed = arrays && a.length !== b.length;
    for (const k of Object.keys(b)) {
      const x = k in a ? diff(a[k], b[k]) : { '=': b[k] };
      if (x !== undefined) { d.c[k] = x; changed = true; }
    }
    if (objects) for (const k of Object.keys(a)) if (!(k in b)) { d.r.push(k); changed = true; }
    return changed ? d : undefined;
  }
  function patch(a, d) {
    if (d === undefined) return a;
    if (!d['#']) return d['='];
    const out = d['#'] === 'a' ? (Array.isArray(a) ? a.slice(0, d.n) : []) : Object.assign({}, a && typeof a === 'object' ? a : {});
    for (const k of Object.keys(d.c)) out[k] = patch(out[k], d.c[k]);
    if (d['#'] === 'a') out.length = d.n;
    else d.r.forEach((k) => delete out[k]);
    return out;
  }

  // ---- pick the newest copy
  const fromLocal = readLocal();
  const fromTab = readTab();
  let rev = Math.max(fromLocal.rev, fromTab.rev);
  let items = Object.assign({}, fromTab.rev > fromLocal.rev ? fromTab.items : fromLocal.items);
  const hand = readHash();
  if (hand && hand.rev > rev && hand.items && typeof hand.items === 'object') {
    const keepDb = items[DB_KEY];
    items = Object.assign({}, hand.items);
    if (hand.db !== undefined) pending[DB_KEY] = hand.db;
    else if (keepDb !== undefined) items[DB_KEY] = keepDb;
    rev = hand.rev;
  }
  if (hand) {
    try { history.replaceState(history.state, '', window.location.href.split('#')[0]); } catch (e) { /* keep the hash */ }
  }

  function writeLocal() {
    if (!local) return;
    try {
      const stale = [];
      for (let i = 0; i < local.length; i++) { const k = local.key(i); if (k && k.startsWith(PREFIX) && k !== REV_KEY && !(k in items)) stale.push(k); }
      stale.forEach((k) => local.removeItem(k));
      Object.entries(items).forEach(([k, v]) => { if (local.getItem(k) !== v) local.setItem(k, v); });
      local.setItem(REV_KEY, String(rev));
    } catch (e) { /* quota - the tab copy still has it */ }
  }
  function writeTab() {
    try { window.name = TAB_MARK + JSON.stringify({ rev, items }); } catch (e) { /* ignore */ }
  }
  function touched() {
    rev = Math.max(Date.now(), rev + 1);
    writeLocal();
    writeTab();
  }

  // bring this folder's localStorage and the tab copy up to date with the newest state
  if (rev !== fromLocal.rev || JSON.stringify(items) !== JSON.stringify(fromLocal.items)) writeLocal();
  writeTab();

  window.AppStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(items, key) ? items[key] : null;
    },
    setItem(key, value) {
      items[key] = String(value);
      touched();
    },
    removeItem(key) {
      if (!(key in items)) return;
      delete items[key];
      touched();
    },
    /* the hardcoded starting value of a key (the simulated database): changes are handed over relative to it */
    registerBase(key, fn) {
      bases[key] = fn;
      if (pending[key] === undefined) return;
      try { items[key] = JSON.stringify(patch(JSON.parse(fn()), pending[key])); } catch (e) { /* keep what this page had */ }
      delete pending[key];
      writeLocal();
      writeTab();
    },
    /* the page about to be opened gets the current state in its address */
    handoff(url) {
      const small = {};
      Object.keys(items).forEach((k) => { if (k !== DB_KEY) small[k] = items[k]; });
      const payload = { rev, items: small };
      if (items[DB_KEY] && bases[DB_KEY]) {
        try {
          const d = diff(JSON.parse(bases[DB_KEY]()), JSON.parse(items[DB_KEY]));
          payload.db = d === undefined ? null : d;
        } catch (e) { delete payload.db; }
      }
      // browsers refuse very long addresses (Firefox: 1 MB): uploaded files go first, then the database changes
      const LIMIT = 900000;
      let encoded = encodeURIComponent(JSON.stringify(payload));
      if (encoded.length > LIMIT && payload.db && payload.db.c) {
        delete payload.db.c.uploadedFiles;
        delete payload.db.c.productImages;
        encoded = encodeURIComponent(JSON.stringify(payload));
      }
      if (encoded.length > LIMIT) { delete payload.db; encoded = encodeURIComponent(JSON.stringify(payload)); }
      return String(url).split('#')[0] + '#' + HASH_KEY + '=' + encoded;
    },
  };
})();
