/*
 * <app-order-status-stepper> - port of src/app/shared/order-status-stepper/order-status-stepper.component.*
 */
(function () {
  'use strict';

  const HALTED_COPY = {
    RETAILER_REJECTED: {
      title: 'Your order was rejected by the shop.',
      message: 'Find another shop where this product is available and continue your order there.',
    },
    SHOP_UNAVAILABLE: { title: 'The shop did not respond to your order.', message: 'Please find another shop for this product.' },
    CANCELLED: { title: 'This order was cancelled.', message: '' },
  };
  const stepIcon = (state) => ({ DONE: 'fa-circle-check', CURRENT: 'fa-circle-dot', FAILED: 'fa-circle-xmark' })[state] || 'fa-circle';
  window.OrderStatusStepper = function (steps, haltedState, key = 'stepper') {
    const halted = haltedState ? (HALTED_COPY[haltedState] ?? { title: haltedState, message: '' }) : null;
    // bring the current stage into view when it changes (the tracker can scroll sideways)
    const currentKey = steps ? ((steps.find((s) => s.state === 'CURRENT') || {}).key ?? null) : null;
    U.registry['__stepper_' + key] = U.registry['__stepper_' + key] || { last: null };
    const memo = U.registry['__stepper_' + key];
    if (currentKey && currentKey !== memo.last) {
      memo.last = currentKey;
      setTimeout(() => {
        const container = document.querySelector(`[data-stepper="${key}"] .stepper-scroll`);
        const current = container && container.querySelector('.state-current');
        if (!container || !current || container.scrollWidth <= container.clientWidth) return;
        container.scrollLeft = current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
      });
    }
    return U.tpl('order-status-stepper', [
      key,
      halted
        ? U.tpl('order-status-stepper-1', [halted.title, halted.message ? U.tpl('order-status-stepper-1-1', [halted.message]) : ''])
        : steps
          ? U.tpl('order-status-stepper-2', [
              steps.length,
              U.each(steps, (step, i) =>
                U.tpl('order-status-stepper-2-1', [
                  U.clsMore('state-' + step.state.toLowerCase(), { 'line-done': i > 0 && steps[i - 1].state === 'DONE' }),
                  U.clsMore(stepIcon(step.state), {
                    'text-emerald-600': step.state === 'DONE',
                    'text-zepto-600': step.state === 'CURRENT',
                    'text-rose-600': step.state === 'FAILED',
                    'text-slate-300': step.state !== 'DONE' && step.state !== 'CURRENT' && step.state !== 'FAILED',
                  }),
                  U.clsMore({
                    'font-bold': step.state === 'CURRENT',
                    'text-slate-900': step.state === 'CURRENT',
                    'text-slate-700': step.state === 'DONE',
                    'text-slate-400': step.state !== 'DONE' && step.state !== 'CURRENT',
                  }),
                  step.label,
                ]),
              ),
            ])
          : '',
    ]);
  };
})();
