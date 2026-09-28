/*
 * AroundU static frontend - core runtime (vanilla JavaScript, no framework).
 *
 * Provides what the Angular app got from the framework, so every page script can stay a close,
 * readable port of its Angular component:
 *   - U.html``        HTML templating (auto-escaped, same whitespace handling as the Angular compiler)
 *   - App             mounts the page and re-renders it (DOM morphing keeps focus/caret/scroll)
 *   - U.date / U.currency / U.number / U.titlecase   the Angular pipes (en-US locale)
 *   - U.control / U.group / V (validators)           a small ReactiveForms equivalent
 *   - Toast           the app-wide toast (ToastService + ToastComponent)
 *   - input helpers   appDigitsOnly / appFormatInput / appIntegerOnly directives
 */
(function () {
  'use strict';

  const U = (window.U = {});

  /* ------------------------------------------------------------------------------------------ */
  /* HTML templating                                                                             */
  /* ------------------------------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------------------------------ */
  /* DOM morphing                                                                                */
  /* ------------------------------------------------------------------------------------------ */

  function keyOf(node) {
    if (node.nodeType !== 1) return null;
    return node.getAttribute('data-key') || node.id || null;
  }

  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.tagName !== b.tagName) return false;
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka || kb) return ka === kb;
    if (a.tagName === 'INPUT') {
      const special = (t) => ['checkbox', 'radio', 'file'].includes((t || 'text').toLowerCase());
      const ta = a.getAttribute('type');
      const tb = b.getAttribute('type');
      if ((special(ta) || special(tb)) && ta !== tb) return false;
    }
    return true;
  }

  function syncAttributes(from, to) {
    const toAttrs = to.attributes;
    for (let i = 0; i < toAttrs.length; i++) {
      const { name, value } = toAttrs[i];
      if (from.getAttribute(name) !== value) from.setAttribute(name, value);
    }
    const fromAttrs = from.attributes;
    for (let i = fromAttrs.length - 1; i >= 0; i--) {
      const name = fromAttrs[i].name;
      if (!to.hasAttribute(name)) from.removeAttribute(name);
    }
  }

  /* the form state the new markup asks for - read BEFORE its children are moved into the live DOM */
  function desiredFormState(to) {
    const tag = to.tagName;
    if (tag === 'INPUT') {
      const type = (to.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return { checked: to.hasAttribute('checked') };
      if (type === 'file') return null;
      return { value: to.getAttribute('value') ?? '' };
    }
    if (tag === 'TEXTAREA') return { value: to.value };
    if (tag === 'SELECT') {
      const options = Array.from(to.options);
      const selected = options.find((o) => o.hasAttribute('selected'));
      return { value: selected ? selected.value : options[0] ? options[0].value : '', select: true };
    }
    return null;
  }

  function applyFormState(from, desired) {
    if (!desired) return;
    if ('checked' in desired) {
      if (from.checked !== desired.checked) from.checked = desired.checked;
    } else if (desired.select) {
      if (!from.multiple && from.value !== desired.value) from.value = desired.value;
    } else if (from.value !== desired.value) {
      from.value = desired.value;
    }
  }

  function morphNode(from, to) {
    if (from.nodeType === 3 || from.nodeType === 8) {
      if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
      return;
    }
    if (from.hasAttribute('data-static')) return; // subtree managed outside the renderer
    const desired = desiredFormState(to);
    syncAttributes(from, to);
    if (from.tagName !== 'TEXTAREA') morphChildren(from, to);
    applyFormState(from, desired);
  }

  function morphChildren(from, to) {
    let f = from.firstChild;
    let t = to.firstChild;
    while (t) {
      const nextT = t.nextSibling;
      if (!f) {
        from.appendChild(t);
        t = nextT;
        continue;
      }
      if (sameNode(f, t)) {
        morphNode(f, t);
        f = f.nextSibling;
        t = nextT;
        continue;
      }
      // keyed match further along the live list?
      const key = keyOf(t);
      let match = null;
      if (key) {
        for (let n = f.nextSibling; n; n = n.nextSibling) {
          if (keyOf(n) === key && sameNode(n, t)) { match = n; break; }
        }
      } else if (f.nextSibling && sameNode(f.nextSibling, t) && !(t.nextSibling && sameNode(f, t.nextSibling))) {
        // a node was removed from the live list
        match = f.nextSibling;
      }
      if (match) {
        while (f !== match) {
          const next = f.nextSibling;
          from.removeChild(f);
          f = next;
        }
        morphNode(f, t);
        f = f.nextSibling;
      } else {
        from.insertBefore(t, f);
      }
      t = nextT;
    }
    while (f) {
      const next = f.nextSibling;
      from.removeChild(f);
      f = next;
    }
  }

  const parser = document.createElement('template');
  U.morph = function (target, html) {
    parser.innerHTML = valueToHtml(html);
    const fragment = parser.content;
    // morph the target's children to the fragment's children
    const wrapper = document.createElement(target.tagName);
    wrapper.appendChild(fragment);
    morphChildren(target, wrapper);
    // a bound <select> shows exactly its control's value - blank when no option matches (like Angular)
    target.querySelectorAll('select[data-value]').forEach((select) => {
      const value = select.getAttribute('data-value');
      if (select.value !== value) select.value = value;
    });
  };

  /* ------------------------------------------------------------------------------------------ */
  /* App: mounting + change detection                                                            */
  /* ------------------------------------------------------------------------------------------ */

  const App = (window.App = {
    root: null,
    renderFn: null,
    scheduled: false,
    afterRender: [],
    escapeHandlers: [],
    mount(root, renderFn) {
      this.root = root;
      this.renderFn = renderFn;
      this.render();
    },
    update() {
      if (this.scheduled || !this.renderFn) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        this.render();
      });
    },
    render() {
      if (!this.renderFn) return;
      U.morph(this.root, this.renderFn());
      const hooks = this.afterRender.splice(0);
      hooks.forEach((fn) => fn());
    },
    /* run once after the next render (e.g. focus an element that just appeared) */
    nextRender(fn) {
      this.afterRender.push(fn);
      this.update();
    },
  });

  /* A state object that re-renders the app whenever one of its properties is assigned (signal-like). */
  U.state = function (initial) {
    return new Proxy(initial, {
      set(target, prop, value) {
        if (target[prop] !== value) {
          target[prop] = value;
          App.update();
        }
        return true;
      },
    });
  };

  /* Any user interaction may change state held outside U.state - re-render after it (zone-like). */
  // (a macrotask, so the browser's default action - e.g. a label checking its radio - has completed first)
  ['click', 'input', 'change', 'keydown', 'keyup', 'submit', 'focusin', 'focusout'].forEach((type) => {
    document.addEventListener(type, () => setTimeout(() => App.update(), 0), false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      App.escapeHandlers.slice().forEach((fn) => fn(event));
      App.update();
    }
  });
  U.onEscape = (fn) => App.escapeHandlers.push(fn);

  /* registry for component instances referenced from inline handlers: U.$('card-12').add() */
  U.registry = {};
  U.$ = (key) => U.registry[key];

  /* ------------------------------------------------------------------------------------------ */
  /* Pipes (Angular en-US locale)                                                                */
  /* ------------------------------------------------------------------------------------------ */

  const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const NAMED_FORMATS = {
    short: 'M/d/yy, h:mm a',
    medium: 'MMM d, y, h:mm:ss a',
    long: "MMMM d, y 'at' h:mm:ss a z",
    shortDate: 'M/d/yy',
    mediumDate: 'MMM d, y',
    longDate: 'MMMM d, y',
    fullDate: 'EEEE, MMMM d, y',
    shortTime: 'h:mm a',
    mediumTime: 'h:mm:ss a',
  };

  /* Same parsing rules as Angular's DatePipe (a date-only ISO string is LOCAL midnight). */
  U.toDate = function (value) {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/.test(trimmed)) {
        const [y, m = 1, d = 1] = trimmed.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      const iso = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/.exec(trimmed);
      if (iso) {
        const ms = iso[7] ? Number((iso[7] + '00').slice(0, 3)) : 0;
        if (iso[8]) {
          let t = Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0), +(iso[6] || 0), ms);
          if (iso[9]) t -= (iso[9] === '+' ? 1 : -1) * ((+iso[10]) * 60 + (+iso[11])) * 60000;
          return new Date(t);
        }
        return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0), +(iso[6] || 0), ms);
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  function pad(n, width) {
    return String(n).padStart(width, '0');
  }

  U.date = function (value, format = 'mediumDate') {
    if (value == null || value === '') return null;
    const date = U.toDate(value);
    if (!date || isNaN(date.getTime())) throw new Error(`InvalidPipeArgument: '${value}' for pipe 'DatePipe'`);
    const pattern = NAMED_FORMATS[format] || format;
    let out = '';
    const re = /'([^']*)'|y+|M+|L+|d+|E+|h+|H+|m+|s+|S+|a+|z+|Z+|./g;
    let m;
    while ((m = re.exec(pattern))) {
      const tok = m[0];
      if (m[1] !== undefined) { out += m[1] === '' ? "'" : m[1]; continue; }
      const c = tok[0];
      const n = tok.length;
      switch (c) {
        case 'y': out += n === 2 ? pad(date.getFullYear() % 100, 2) : pad(date.getFullYear(), n); break;
        case 'M': case 'L':
          out += n === 1 ? date.getMonth() + 1 : n === 2 ? pad(date.getMonth() + 1, 2) : n === 3 ? MONTHS_SHORT[date.getMonth()] : MONTHS_LONG[date.getMonth()];
          break;
        case 'd': out += pad(date.getDate(), n); break;
        case 'E': out += n <= 3 ? DAYS_SHORT[date.getDay()] : DAYS_LONG[date.getDay()]; break;
        case 'h': out += pad(date.getHours() % 12 || 12, n); break;
        case 'H': out += pad(date.getHours(), n); break;
        case 'm': out += pad(date.getMinutes(), n); break;
        case 's': out += pad(date.getSeconds(), n); break;
        case 'S': out += pad(date.getMilliseconds(), 3).slice(0, n); break;
        case 'a': out += date.getHours() < 12 ? 'AM' : 'PM'; break;
        case 'z': case 'Z': {
          const off = -date.getTimezoneOffset();
          const sign = off >= 0 ? '+' : '-';
          out += 'GMT' + sign + pad(Math.floor(Math.abs(off) / 60), 2) + ':' + pad(Math.abs(off) % 60, 2);
          break;
        }
        default: out += tok;
      }
    }
    return out;
  };

  /* DecimalPipe digitsInfo "{minInt}.{minFrac}-{maxFrac}" */
  function formatDigits(value, digitsInfo, defMin, defMax) {
    let minInt = 1;
    let minFrac = defMin;
    let maxFrac = defMax;
    if (digitsInfo) {
      const parts = /^(\d+)?\.((\d+)(-(\d+))?)?$/.exec(digitsInfo);
      if (parts) {
        if (parts[1] != null) minInt = +parts[1];
        if (parts[3] != null) minFrac = +parts[3];
        if (parts[5] != null) maxFrac = +parts[5];
        else if (parts[3] != null && maxFrac < minFrac) maxFrac = minFrac;
      }
    }
    const negative = value < 0;
    const abs = Math.abs(value);
    // round half away from zero at maxFrac, like Angular's roundNumber
    const factor = Math.pow(10, maxFrac);
    let rounded = Math.round((abs + Number.EPSILON) * factor) / factor;
    let [intPart, fracPart = ''] = rounded.toFixed(maxFrac).split('.');
    fracPart = fracPart.replace(/0+$/, '');
    while (fracPart.length < minFrac) fracPart += '0';
    intPart = intPart.padStart(minInt, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return { negative, text: fracPart ? intPart + '.' + fracPart : intPart };
  }

  function toNumber(value) {
    if (value == null || value === '' || (typeof value === 'number' && isNaN(value))) return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (isNaN(n)) throw new Error(`InvalidPipeArgument: '${value}' is not a number`);
    return n;
  }

  U.number = function (value, digitsInfo) {
    const n = toNumber(value);
    if (n == null) return null;
    const r = formatDigits(n, digitsInfo, 0, 3);
    return (r.negative && r.text.replace(/[0.,]/g, '') !== '' ? '-' : '') + r.text;
  };

  const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  U.currency = function (value, code = 'USD', display = 'symbol', digitsInfo) {
    const n = toNumber(value);
    if (n == null) return null;
    const r = formatDigits(n, digitsInfo, 2, 2);
    const symbol = display === 'code' ? code : CURRENCY_SYMBOLS[code] || code;
    return (r.negative ? '-' : '') + symbol + r.text;
  };

  U.percent = function (value, digitsInfo) {
    const n = toNumber(value);
    if (n == null) return null;
    const r = formatDigits(n * 100, digitsInfo, 0, 0);
    return (r.negative ? '-' : '') + r.text + '%';
  };

  U.titlecase = function (value) {
    if (value == null) return null;
    return String(value).replace(/[^\s]+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
  };
  U.uppercase = (v) => (v == null ? null : String(v).toUpperCase());
  U.lowercase = (v) => (v == null ? null : String(v).toLowerCase());

  /* ------------------------------------------------------------------------------------------ */
  /* Forms (ReactiveForms equivalent)                                                            */
  /* ------------------------------------------------------------------------------------------ */

  const V = (window.V = {
    required: (c) => {
      const v = c.value;
      return v == null || (typeof v === 'string' && v.length === 0) || (Array.isArray(v) && v.length === 0) ? { required: true } : null;
    },
    requiredTrue: (c) => (c.value === true ? null : { required: true }),
    email: (c) => {
      const v = c.value;
      if (v == null || v === '') return null;
      const EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return EMAIL.test(v) ? null : { email: true };
    },
    minLength: (min) => (c) => {
      const v = c.value;
      if (v == null || v.length === undefined || v.length === 0) return null;
      return v.length < min ? { minlength: { requiredLength: min, actualLength: v.length } } : null;
    },
    maxLength: (max) => (c) => {
      const v = c.value;
      return v != null && v.length !== undefined && v.length > max ? { maxlength: { requiredLength: max, actualLength: v.length } } : null;
    },
    min: (min) => (c) => {
      const v = c.value;
      if (v == null || v === '' || isNaN(parseFloat(v))) return null;
      return parseFloat(v) < min ? { min: { min, actual: v } } : null;
    },
    max: (max) => (c) => {
      const v = c.value;
      if (v == null || v === '' || isNaN(parseFloat(v))) return null;
      return parseFloat(v) > max ? { max: { max, actual: v } } : null;
    },
    pattern: (pattern) => {
      let regex;
      if (typeof pattern === 'string') regex = new RegExp('^' + pattern.replace(/^\^/, '').replace(/\$$/, '') + '$');
      else regex = pattern;
      return (c) => {
        const v = c.value;
        if (v == null || v === '') return null;
        return regex.test(String(v)) ? null : { pattern: { requiredPattern: String(regex), actualValue: v } };
      };
    },
  });

  class FormControl {
    constructor(value, validators = [], opts = {}) {
      this.initial = value;
      this._value = value;
      this.validators = Array.isArray(validators) ? validators : [validators];
      this.touched = false;
      this.dirty = false;
      this.disabled = !!opts.disabled;
      this.nonNullable = !!opts.nonNullable;
      this.parent = null;
    }
    get value() { return this._value; }
    set value(v) { this.setValue(v); }
    setValue(v) { this._value = v; this.manualErrors = null; App.update(); }
    patchValue(v) { this.setValue(v); }
    reset(v) {
      this._value = v !== undefined ? v : (this.nonNullable ? this.initial : null);
      this.touched = false;
      this.dirty = false;
      App.update();
    }
    setErrors(errors) { this.manualErrors = errors; App.update(); }
    get errors() {
      if (this.disabled) return null;
      let errors = this.manualErrors ? Object.assign({}, this.manualErrors) : null;
      for (const fn of this.validators) {
        const e = fn(this);
        if (e) errors = Object.assign(errors || {}, e);
      }
      return errors;
    }
    hasError(key) { const e = this.errors; return !!(e && e[key]); }
    getError(key) { const e = this.errors; return e ? e[key] : null; }
    get valid() { return this.disabled || !this.errors; }
    get invalid() { return !this.valid; }
    get untouched() { return !this.touched; }
    get pristine() { return !this.dirty; }
    markAsTouched() { this.touched = true; App.update(); }
    markAsUntouched() { this.touched = false; App.update(); }
    markAsDirty() { this.dirty = true; App.update(); }
    markAsPristine() { this.dirty = false; App.update(); }
    markAllAsTouched() { this.markAsTouched(); }
    setValidators(validators) { this.validators = Array.isArray(validators) ? validators : validators ? [validators] : []; }
    addValidators(validators) { this.validators = this.validators.concat(validators); }
    clearValidators() { this.validators = []; }
    updateValueAndValidity() { App.update(); }
    disable() { this.disabled = true; App.update(); }
    enable() { this.disabled = false; App.update(); }
    get enabled() { return !this.disabled; }
    /* from an <input>/<select>/<textarea> */
    input(el) {
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
      else v = el.value;
      this._value = v;
      this.manualErrors = null;
      this.dirty = true;
      App.update();
    }
    blur() { this.touched = true; App.update(); }
  }

  class FormGroup {
    constructor(controls, validators = []) {
      this.controls = controls;
      this.validators = Array.isArray(validators) ? validators : [validators];
      for (const c of Object.values(controls)) c.parent = this;
    }
    get value() {
      const out = {};
      for (const [k, c] of Object.entries(this.controls)) if (!c.disabled) out[k] = c.value;
      return out;
    }
    getRawValue() {
      const out = {};
      for (const [k, c] of Object.entries(this.controls)) out[k] = c instanceof FormGroup ? c.getRawValue() : c.value;
      return out;
    }
    get(name) { return this.controls[name]; }
    get errors() {
      let errors = null;
      for (const fn of this.validators) {
        const e = fn(this);
        if (e) errors = Object.assign(errors || {}, e);
      }
      return errors;
    }
    hasError(key, path) { if (path) return this.controls[path].hasError(key); const e = this.errors; return !!(e && e[key]); }
    get valid() { return !this.errors && Object.values(this.controls).every((c) => c.valid); }
    get invalid() { return !this.valid; }
    get touched() { return Object.values(this.controls).some((c) => c.touched); }
    get dirty() { return Object.values(this.controls).some((c) => c.dirty); }
    get pristine() { return !this.dirty; }
    markAllAsTouched() { Object.values(this.controls).forEach((c) => c.markAllAsTouched()); App.update(); }
    markAsPristine() { Object.values(this.controls).forEach((c) => c.markAsPristine()); }
    markAsUntouched() { Object.values(this.controls).forEach((c) => c.markAsUntouched()); }
    patchValue(values) {
      for (const [k, v] of Object.entries(values || {})) if (this.controls[k]) {
        if (this.controls[k] instanceof FormGroup) this.controls[k].patchValue(v);
        else this.controls[k].setValue(v);
      }
    }
    setValue(values) { this.patchValue(values); }
    reset(values) {
      for (const [k, c] of Object.entries(this.controls)) c.reset(values ? values[k] : undefined);
    }
  }

  U.FormControl = FormControl;
  U.FormGroup = FormGroup;
  U.control = (value, validators, opts) => new FormControl(value, validators, opts);
  U.group = (controls, validators) => new FormGroup(controls, validators);

  /*
   * Attribute string for a form control bound element (the equivalent of formControlName/ngModel):
   *   <input ${U.bind('Page.form', 'email')}>   ->  value + input/blur handlers
   */
  U.bind = function (formPath, name, control) {
    const ctrl = control;
    const ref = `${formPath}.controls['${name}']`;
    let value = ctrl ? ctrl.value : '';
    const attrs = [];
    if (value !== null && value !== undefined && typeof value !== 'boolean') attrs.push(`value="${U.esc(value)}"`);
    if (value === true) attrs.push('checked');
    if (ctrl && ctrl.disabled) attrs.push('disabled');
    attrs.push(`oninput="${ref}.input(this)"`);
    attrs.push(`onchange="${ref}.input(this)"`);
    attrs.push(`onblur="${ref}.blur()"`);
    return U.raw(attrs.join(' '));
  };

  /*
   * A <select> bound to a control (formControlName): shows exactly the control's value (blank when no option
   * matches, as Angular does). `parse` converts the option's string value (e.g. Number for [ngValue]="id").
   *   <select ${U.bindSelect('Page.form', 'rating', ctrl, { parse: 'Number', onchange: 'Page.x()' })}>
   */
  U.bindSelect = function (formPath, name, control, opts = {}) {
    const ref = `${formPath}.controls['${name}']`;
    const value = control ? control.value : '';
    const parse = opts.parse ? `(this.value === 'null' ? null : ${opts.parse}(this.value))` : 'this.value';
    const attrs = [
      `data-value="${U.esc(value === null || value === undefined ? 'null' : value)}"`,
      `onchange="${ref}.setValue(${parse}); ${ref}.markAsDirty(); ${opts.onchange || ''}"`,
      `onblur="${ref}.blur()"`,
    ];
    if (control && control.disabled) attrs.push('disabled');
    return U.raw(attrs.join(' '));
  };

  /* <option> list helper: selected attribute set on the option equal to `current` */
  U.sel = (current, value) => (String(current ?? '') === String(value ?? '') ? 'selected' : '');
  U.chk = (flag) => (flag ? 'checked' : '');
  U.dis = (flag) => (flag ? 'disabled' : '');

  /* ------------------------------------------------------------------------------------------ */
  /* Input directives (appDigitsOnly / appFormatInput / appIntegerOnly)                          */
  /* ------------------------------------------------------------------------------------------ */

  function digitsMax(el) {
    const limit = Number(el.getAttribute('data-digits-only'));
    return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
  }

  document.addEventListener('keydown', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.hasAttribute('data-digits-only')) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      if (!/^[0-9]$/.test(event.key)) { event.preventDefault(); return; }
      const noSelection = el.selectionStart === el.selectionEnd;
      if (noSelection && el.value.length >= digitsMax(el)) event.preventDefault();
    }
    if (el.hasAttribute('data-integer-only')) {
      if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault();
    }
  }, true);

  document.addEventListener('paste', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement)) return;
    const text = (event.clipboardData && event.clipboardData.getData('text')) || '';
    if (el.hasAttribute('data-digits-only')) {
      event.preventDefault();
      const digits = text.replace(/\D/g, '');
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      el.value = (el.value.slice(0, start) + digits + el.value.slice(end)).slice(0, digitsMax(el));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (el.hasAttribute('data-integer-only') && !/^[0-9]*$/.test(text.trim())) event.preventDefault();
  }, true);

  /* capture phase: the value is cleaned before the element's own input handler reads it */
  document.addEventListener('input', (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el.hasAttribute('data-digits-only')) {
      const clean = el.value.replace(/\D/g, '').slice(0, digitsMax(el));
      if (clean !== el.value) el.value = clean;
    }
    const format = el.getAttribute('data-format-input');
    if (format && window.InputRules) {
      const raw = el.value;
      const formatted = window.InputRules.format(format, raw);
      if (formatted !== raw) {
        const caret = el.selectionStart ?? raw.length;
        const isReal = (ch) => window.InputRules.isReal(format, ch);
        let real = 0;
        for (const ch of raw.slice(0, caret)) if (isReal(ch)) real++;
        el.value = formatted;
        if (document.activeElement === el) {
          let pos = formatted.length;
          if (real <= 0) pos = 0;
          else {
            let seen = 0;
            for (let i = 0; i < formatted.length; i++) if (isReal(formatted[i]) && ++seen === real) { pos = i + 1; break; }
          }
          el.setSelectionRange(pos, pos);
        }
      }
    }
  }, true);

  /* ------------------------------------------------------------------------------------------ */
  /* Toast (ToastService + ToastComponent)                                                       */
  /* ------------------------------------------------------------------------------------------ */

  const Toast = (window.Toast = {
    nextId: 0,
    current: null,
    show(text, variant = 'info', durationMs) {
      const id = ++this.nextId;
      const duration = durationMs ?? (variant === 'error' || variant === 'warning' ? 5000 : 3000);
      this.current = { id, text, variant };
      App.update();
      setTimeout(() => {
        if (this.current && this.current.id === id) {
          this.current = null;
          App.update();
        }
      }, duration);
    },
    dismiss() {
      this.current = null;
      App.update();
    },
    open(text, _action, config) {
      this.show(text, 'info', (config && config.duration) || 3000);
    },
    render() {
      const t = this.current;
      if (!t) return U.html``;
      return U.html`
        <div class="${U.cls('fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-card-hover animate-fade-in', {
          'bg-slate-900': t.variant === 'info',
          'bg-zgreen-500': t.variant === 'success',
          'bg-rose-600': t.variant === 'error',
          'bg-amber-500': t.variant === 'warning',
        })}" role="status" aria-live="${t.variant === 'error' || t.variant === 'warning' ? 'assertive' : 'polite'}" data-key="toast-${t.id}">
          <i class="${U.cls('fa-solid', {
            'fa-circle-info': t.variant === 'info',
            'fa-circle-check': t.variant === 'success',
            'fa-circle-exclamation': t.variant === 'error',
            'fa-triangle-exclamation': t.variant === 'warning',
          })}" aria-hidden="true"></i>
          <span>${t.text}</span>
          <button type="button" class="ml-1 text-white/80 hover:text-white" onclick="Toast.dismiss()" aria-label="Dismiss notification">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      `;
    },
  });

  /* ------------------------------------------------------------------------------------------ */
  /* Misc helpers                                                                                */
  /* ------------------------------------------------------------------------------------------ */

  /* query parameters of the current page (?id=...) */
  U.query = (name) => new URLSearchParams(window.location.search).get(name);

  /* resolves after `ms` - simulates the short latency a real request has */
  U.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  U.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  /* Port of core/api/http-error.util.ts extractErrorMessage() for the simulated backend's errors. */
  U.extractErrorMessage = function (error, fallback = 'Something went wrong. Please try again.') {
    if (!error || typeof error.status !== 'number') return fallback;
    if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
    const body = error.error;
    const validationErrors = body && typeof body === 'object' && body.validationErrors && typeof body.validationErrors === 'object'
      ? body.validationErrors
      : body && typeof body === 'object' && body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors) ? body.errors : null;
    const bodyMessage = validationErrors && Object.keys(validationErrors).length > 0
      ? Object.values(validationErrors).join(' ')
      : body && typeof body === 'object' ? body.userMessage || body.message || body.error : typeof body === 'string' ? body : null;
    if (error.status === 401) {
      if (error.url && error.url.includes('/api/v1/auth/login')) return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : fallback;
      return 'Your session has expired. Please log in again.';
    }
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status === 423) return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : 'Your password has expired and must be changed before you can log in.';
    if (error.status >= 500) return 'Something went wrong. Please try again later.';
    if (typeof bodyMessage === 'string' && bodyMessage.trim()) return bodyMessage;
    return fallback;
  };

  /* Local wall-clock ISO string (core/api/date.util.ts toLocalDateTimeString) */
  U.toLocalDateTimeString = function (date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}` +
      `T${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
  };

  /* Triggers a browser download of generated content (the static stand-in for a server-built file). */
  U.download = function (fileName, content, type = 'text/plain') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
