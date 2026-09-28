/*
 * <app-password-requirements> - port of src/app/shared/password-requirements/password-requirements.component.*
 */
(function () {
  'use strict';

  window.PasswordRequirements = function (value) {
    const checks = InputRules.passwordChecks(value);
    const started = !!value;
    return U.tpl('password-requirements', [
      U.each(checks, (check) =>
        U.tpl('password-requirements-1', [
          U.clsMore({ 'text-emerald-600': check.met, 'text-rose-600': !check.met && started, 'text-slate-400': !check.met && !started }),
          U.clsMore({ 'fa-circle-check': check.met, 'fa-circle-xmark': !check.met && started, 'fa-circle': !check.met && !started }),
          check.label,
        ]),
      ),
    ]);
  };
})();
