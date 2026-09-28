/*
 * Templates - the markup of every page and component is written in the page's HTML file:
 *   - the layout and the page itself inline inside <app-root>, each part marked <!--tpl:id--> ... <!--/tpl:id-->;
 *   - parts that are shown conditionally or repeated (rows, dialogs, messages) as <template id="..."> elements,
 *     placed where they appear;
 *   - shared components' templates after </app-root>, copied from common/<component>/<component>.html.
 * The places that change are marked in the markup: <!--{{0}}--> for content, {{0}} inside a tag.
 *
 *   U.tpl('id', [value0, value1, ...])   renders template `id` with its values (the JS supplies only the values)
 */
(function () {
  'use strict';

  const MARK = /<!--\{\{(\d+)\}\}-->|&lt;!--\{\{(\d+)\}\}--&gt;|\{\{(\d+)\}\}=""|\{\{(\d+)\}\}/g;
  const strings = {};
  let sources = null;

  /* pulls nested <template id> elements and inline <!--tpl:id--> sections out of a template's markup */
  function extract(source, id, out) {
    let s = source;
    for (;;) {
      const m = /<!--tpl:([\w-]+)(?: [^>]*)?-->/.exec(s);
      if (!m) break;
      const endTag = `<!--/tpl:${m[1]}-->`;
      const end = s.indexOf(endTag, m.index);
      if (end < 0) throw new Error('Template "' + m[1] + '" has no end marker');
      extract(s.slice(m.index + m[0].length, end), m[1], out);
      s = s.slice(0, m.index) + s.slice(end + endTag.length);
    }
    for (;;) {
      const m = /<template id="([^"]+)">/.exec(s);
      if (!m) break;
      const re = /<template\b[^>]*>|<\/template>/g;
      re.lastIndex = m.index + m[0].length;
      let depth = 1, t;
      while ((t = re.exec(s))) { depth += t[0] === '</template>' ? -1 : 1; if (!depth) break; }
      if (!t) throw new Error('Template "' + m[1] + '" is not closed');
      extract(s.slice(m.index + m[0].length, t.index), m[1], out);
      s = s.slice(0, m.index) + s.slice(t.index + t[0].length);
    }
    out[id] = s;
    return out;
  }

  function load() {
    sources = {};
    const root = document.querySelector('app-root');
    if (root) extract(root.innerHTML, 'app', sources);
    document.querySelectorAll('body > template[id]').forEach((el) => extract(el.innerHTML, el.id, sources));
  }

  function compile(id) {
    if (!sources) load();
    const source = sources[id];
    if (source === undefined) throw new Error('Template "' + id + '" is not in this page');
    const parts = [];
    let last = 0, n = 0, m;
    MARK.lastIndex = 0;
    while ((m = MARK.exec(source))) {
      const k = Number(m[1] ?? m[2] ?? m[3] ?? m[4]);
      if (k !== n) throw new Error('Template "' + id + '": value ' + k + ' found where ' + n + ' was expected');
      parts.push(source.slice(last, m.index));
      last = m.index + m[0].length;
      n++;
    }
    parts.push(source.slice(last));
    return (strings[id] = parts);
  }

  /* reads every template of the page; boot() calls it before the page is first rendered */
  U.loadTemplates = function () {
    if (!sources) load();
  };

  U.tpl = function (id, values) {
    return U.html(strings[id] || compile(id), ...(values || []));
  };
})();
