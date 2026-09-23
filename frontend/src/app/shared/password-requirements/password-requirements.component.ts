import { Component, Input } from '@angular/core';
import { PasswordCheck, passwordChecks } from '../../core/validation/password-policy';

/**
 * Live "Password requirements" checklist. Bind it to the password control's current value
 * (`<app-password-requirements [value]="form.controls.password.value" />`): every rule turns valid the moment
 * it is satisfied. The rules come from core/validation/password-policy.ts, the same policy the backend enforces.
 */
@Component({
  selector: 'app-password-requirements',
  standalone: true,
  template: `
    <div class="mt-2" aria-live="polite">
      <p class="mb-1 text-xs font-bold text-slate-700">Password requirements</p>
      <ul class="m-0 list-none space-y-1 p-0 text-xs">
        @for (check of checks; track check.key) {
          <li class="flex items-center gap-1.5 font-semibold"
              [class.text-emerald-600]="check.met"
              [class.text-rose-600]="!check.met && started"
              [class.text-slate-400]="!check.met && !started">
            <i class="fa-solid" [class.fa-circle-check]="check.met" [class.fa-circle-xmark]="!check.met && started" [class.fa-circle]="!check.met && !started"></i>
            {{ check.label }}
          </li>
        }
      </ul>
    </div>
  `,
})
export class PasswordRequirementsComponent {
  @Input() value: string | null | undefined = '';

  get checks(): PasswordCheck[] {
    return passwordChecks(this.value);
  }

  /** Before the first character nothing is "wrong" yet, so the list stays neutral. */
  get started(): boolean {
    return !!this.value;
  }
}
