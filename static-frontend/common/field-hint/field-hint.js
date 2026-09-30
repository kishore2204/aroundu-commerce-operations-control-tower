/*
 * <app-field-hint> - port of src/app/shared/field-hint/field-hint.component.*
 */
(function () {
  'use strict';

  let hintId = 0;
  window.FieldHint = function (field, key) {
    const inst = U.component(key || 'field-hint-' + field, () => ({
      tooltipId: `field-hint-${++hintId}`,
      open: false,
      above: false,
      shift: 0,
      placed: false,
      show() {
        if (this.open) return;
        this.open = true;
        App.nextRender(() => this.place());
        App.update();
      },
      hide() {
        this.open = false;
        this.placed = false;
        App.update();
      },
      onClick(event) {
        event.preventDefault();
        this.show();
      },
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
    return U.tpl('field-hint', [
      inst.key,
      r,
      r,
      r,
      `Show ${hint.label} requirements`,
      inst.tooltipId,
      inst.open,
      r,
      r,
      r,
      inst.tooltipId,
      U.clsMore({
        hidden: !inst.open,
        'opacity-0': !inst.placed,
        'top-full': !inst.above,
        'pt-1.5': !inst.above,
        'bottom-full': inst.above,
        'pb-1.5': inst.above,
      }),
      inst.shift,
      hint.text,
    ]);
  };
})();
