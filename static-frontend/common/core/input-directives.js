/*
 * Input directives - appDigitsOnly / appFormatInput / appIntegerOnly: inputs marked with data-digits-only,
 * data-format-input or data-integer-only are filtered and formatted while typing.
 */
(function () {
  'use strict';

  const U = window.U;

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

})();
