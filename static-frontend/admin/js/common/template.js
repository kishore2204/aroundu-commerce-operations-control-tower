/*
 * Templating - U.html`...` tagged templates (auto-escaped, with the same whitespace handling as the
 * Angular template compiler), U.raw, U.cls, U.each and U.arg. Every page and component renders with these.
 * This file creates the U namespace, so it is loaded first.
 */
(function () {
  'use strict';

  const U = (window.U = {});

  class SafeHtml {
    constructor(value) { this.value = value; }
    toString() { return this.value; }
  }
  U.SafeHtml = SafeHtml;
  U.raw = (value) => new SafeHtml(value == null ? '' : String(value));

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = (value) => (value == null ? '' : String(value).replace(/[&<>"']/g, (c) => ESC[c]));

  /* Whitespace characters the Angular template compiler collapses (note: no  ). */
  const WS = ' \\f\\n\\r\\t\\v\\u1680\\u180e\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff';
  const WS_RUN = new RegExp('[' + WS + ']+', 'g');
  const NOT_BLANK = new RegExp('[^' + WS + ']');

  function isBlock(value) {
    return value instanceof SafeHtml || Array.isArray(value);
  }

  function valueToHtml(value) {
    if (value == null || value === false || value === true) return '';
    if (value instanceof SafeHtml) return value.value;
    if (Array.isArray(value)) return value.map(valueToHtml).join('');
    return U.esc(value);
  }

  /*
   * Tagged template. Static template text is processed exactly like Angular's default
   * (preserveWhitespaces: false) compiler: a text node made only of whitespace is dropped, any other
   * text node has each whitespace run collapsed to one space. Interpolated values are never altered.
   * A nested U.html`` / array value counts as a block (like @if/@for), a plain value as text.
   */
  U.html = function (strings, ...values) {
    let out = '';
    let inTag = false;
    let quote = null;
    let rawTag = null; // inside <pre>/<textarea>/<script>/<style>: keep text as is
    // pending static text segment of the current text node
    let seg = '';
    let segTouchesText = false; // true once the segment is adjacent to a text interpolation

    const flushSeg = (rightIsText) => {
      if (!seg) return;
      if (rawTag) { out += seg; }
      else if (segTouchesText || rightIsText || NOT_BLANK.test(seg)) { out += seg.replace(WS_RUN, ' '); }
      seg = '';
    };

    for (let i = 0; i < strings.length; i++) {
      const s = strings[i];
      for (let j = 0; j < s.length; j++) {
        const ch = s[j];
        if (inTag) {
          out += ch;
          if (quote) { if (ch === quote) quote = null; }
          else if (ch === '"' || ch === "'") quote = ch;
          else if (ch === '>') inTag = false;
          continue;
        }
        if (ch === '<' && /[a-zA-Z/!]/.test(s[j + 1] || '')) {
          flushSeg(false);
          segTouchesText = false;
          inTag = true;
          const m = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(s.slice(j));
          if (m) {
            const name = m[1].toLowerCase();
            if (s[j + 1] === '/') { if (rawTag === name) rawTag = null; }
            else if (['pre', 'textarea', 'script', 'style'].includes(name)) rawTag = name;
          }
          out += ch;
          continue;
        }
        seg += ch;
      }
      if (i < values.length) {
        const v = values[i];
        if (inTag) {
          out += valueToHtml(v);
        } else if (isBlock(v)) {
          flushSeg(false);
          segTouchesText = false;
          out += valueToHtml(v);
        } else {
          segTouchesText = true;
          flushSeg(true);
          segTouchesText = true;
          out += valueToHtml(v);
        }
      }
    }
    flushSeg(false);
    return new SafeHtml(out);
  };

  /* class list builder: U.cls('a b', { c: true, d: false }, cond && 'e') */
  U.cls = function (...parts) {
    const list = [];
    for (const part of parts) {
      if (!part) continue;
      if (typeof part === 'string') list.push(part);
      else if (typeof part === 'object') for (const k of Object.keys(part)) if (part[k]) list.push(k);
    }
    return list.join(' ');
  };

  /* Renders `items` with `fn`, like @for. */
  U.each = (items, fn) => (items || []).map((item, index) => fn(item, index));

  /* JSON-safe argument for inline handlers: onclick="Page.open(${U.arg(x)})" */
  U.arg = (value) => U.raw(U.esc(JSON.stringify(value === undefined ? null : value)));

  /* used by dom-morph.js to turn a rendered template into markup */
  U.valueToHtml = valueToHtml;
})();
