/*
 * AppStorage - where the static copy keeps its state: the signed-in session, the simulated database and the
 * small "remembered" lists (same keys as the Angular app, all starting with "aroundu.").
 *
 * The pages live in different folders (customer/commerce, retailer, admin ...). Opened straight from disk
 * (file://), some browsers give every folder - or every file - its own localStorage, or block it altogether,
 * so a session saved by the login page would be invisible to the dashboard it opens. Therefore every change is
 * kept in three places, and the newest copy wins when a page loads:
 *   1. localStorage, when the browser allows it (survives closing the tab);
 *   2. the tab's window.name, which a tab keeps from page to page whatever the folder;
 *   3. for the session only, the URL hash of the page being opened (#aroundu-session=...), removed from the
 *      address bar as soon as that page has read it.
 *
 *   AppStorage.getItem(key) / setItem(key, value) / removeItem(key)   - the localStorage API
 *   AppStorage.handoff(url)                                            - url + the session hash (used by Nav)
 */
(function () {
  'use strict';

  const PREFIX = 'aroundu.';
  const REV_KEY = 'aroundu.rev';
  const SESSION_KEY = 'aroundu.session';
  const TAB_MARK = 'aroundu-state:';
  const HASH_KEY = 'aroundu-session';

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

  // ---- pick the newest copy
  const fromLocal = readLocal();
  const fromTab = readTab();
  let rev = Math.max(fromLocal.rev, fromTab.rev);
  let items = Object.assign({}, fromTab.rev > fromLocal.rev ? fromTab.items : fromLocal.items);
  const hand = readHash();
  if (hand && hand.rev > rev) {
    if (hand.session) items[SESSION_KEY] = hand.session; else delete items[SESSION_KEY];
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
    /* the page about to be opened gets the current session in its URL hash */
    handoff(url) {
      const payload = encodeURIComponent(JSON.stringify({ rev, session: items[SESSION_KEY] || null }));
      return String(url).split('#')[0] + '#' + HASH_KEY + '=' + payload;
    },
  };
})();
