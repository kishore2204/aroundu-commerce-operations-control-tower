/*
 * <app-field-hint> - port of src/app/shared/field-hint/field-hint.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  let hintId = 0;
  window.FieldHint = function (field, key) {
    const inst = U.component(key || 'field-hint-' + field, () => ({
      tooltipId: `field-hint-${++hintId}`,
      open: false, above: false, shift: 0, placed: false,
      show() {
        if (this.open) return;
        this.open = true;
        App.nextRender(() => this.place());
        App.update();
      },
      hide() { this.open = false; this.placed = false; App.update(); },
      onClick(event) { event.preventDefault(); this.show(); },
      place() {
        if (!this.open) return;
        const host = document.querySelector(`[data-hint="${this.key}"]`);
        if (!host) return;
        const button = host.querySelector('button').getBoundingClientRect();
        const box = host.querySelector('[role="tooltip"]');
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        const margin = 8;
        const centred = button.left + button.width / 2 - width / 2;
        const clamped = Math.max(margin, Math.min(centred, window.innerWidth - width - margin));
        this.shift = Math.round(clamped - button.left);
        this.above = button.bottom + height + margin > window.innerHeight && button.top - height - margin > 0;
        this.placed = true;
        App.update();
      },
    }));
    const hint = InputRules.FIELD_HINTS[field];
    const r = inst.ref;
    return html`
      <app-field-hint><span class="relative inline-block align-middle" data-hint="${inst.key}" onmouseenter="${r}.show()" onmouseleave="${r}.hide()" onkeydown="if (event.key === 'Escape') ${r}.hide()">
        <button type="button" class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-slate-400 transition-colors hover:text-violet-600 focus-visible:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="${`Show ${hint.label} requirements`}" aria-describedby="${inst.tooltipId}" aria-expanded="${inst.open}"
          onfocus="${r}.show()" onblur="${r}.hide()" onclick="${r}.onClick(event)">
          <i class="fa-solid fa-circle-info text-[0.8rem]" aria-hidden="true"></i>
        </button>
        <span role="tooltip" id="${inst.tooltipId}"
          class="${U.cls('absolute z-50 w-64 max-w-[calc(100vw-1rem)] px-0 text-left', { hidden: !inst.open, 'opacity-0': !inst.placed, 'top-full': !inst.above, 'pt-1.5': !inst.above, 'bottom-full': inst.above, 'pb-1.5': inst.above })}"
          style="left: ${inst.shift}px;">
          <span class="block whitespace-pre-line rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg">${hint.text}</span>
        </span>
      </span></app-field-hint>`;
  };
})();
