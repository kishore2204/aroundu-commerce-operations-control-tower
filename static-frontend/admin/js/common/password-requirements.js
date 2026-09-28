/*
 * <app-password-requirements> - port of src/app/shared/password-requirements/password-requirements.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.PasswordRequirements = function (value) {
    const checks = InputRules.passwordChecks(value);
    const started = !!value;
    return html`
      <app-password-requirements><div class="mt-2" aria-live="polite">
        <p class="mb-1 text-xs font-bold text-slate-700">Password requirements</p>
        <ul class="m-0 list-none space-y-1 p-0 text-xs">
          ${U.each(checks, (check) => html`
            <li class="${U.cls('flex items-center gap-1.5 font-semibold', { 'text-emerald-600': check.met, 'text-rose-600': !check.met && started, 'text-slate-400': !check.met && !started })}">
              <i class="${U.cls('fa-solid', { 'fa-circle-check': check.met, 'fa-circle-xmark': !check.met && started, 'fa-circle': !check.met && !started })}"></i>
              ${check.label}
            </li>`)}
        </ul>
      </div></app-password-requirements>`;
  };
})();
