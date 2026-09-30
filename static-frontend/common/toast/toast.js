/*
 * Toast - port of the app-wide ToastService + <app-toast> component (the snack bar at the bottom of the page).
 */
(function () {
  'use strict';

  const U = window.U;

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
      if (!t) return U.tpl('toast');
      return U.tpl('toast-2', [
        U.clsMore({
          'bg-slate-900': t.variant === 'info',
          'bg-zgreen-500': t.variant === 'success',
          'bg-rose-600': t.variant === 'error',
          'bg-amber-500': t.variant === 'warning',
        }),
        t.variant === 'error' || t.variant === 'warning' ? 'assertive' : 'polite',
        t.id,
        U.clsMore({
          'fa-circle-info': t.variant === 'info',
          'fa-circle-check': t.variant === 'success',
          'fa-circle-exclamation': t.variant === 'error',
          'fa-triangle-exclamation': t.variant === 'warning',
        }),
        t.text,
      ]);
    },
  });
})();
