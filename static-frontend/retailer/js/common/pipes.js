/*
 * Pipes - U.date, U.currency, U.number, U.percent, U.titlecase ...: the Angular pipes with the en-US locale,
 * so dates and amounts print exactly like the Angular app.
 */
(function () {
  'use strict';

  const U = window.U;

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

})();
