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

})();
