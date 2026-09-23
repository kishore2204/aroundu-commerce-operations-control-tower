import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { PasswordRequirementsComponent } from '../../../shared/password-requirements/password-requirements.component';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import { PASSWORD_MAX_LENGTH, passwordPolicyValidator } from '../../../core/validation/password-policy';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { mismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [PasswordRequirementsComponent, FieldHintComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
/*
##################################################################

                                           TK_INC0010078_Password_Visibility_Toggle_3239376

#####################################################################
*/
export class ResetPasswordComponent {
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly success = signal(false);
  readonly token = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    route: ActivatedRoute,
  ) {
    this.token.set(route.snapshot.queryParamMap.get('token'));
  }

  submit(): void {
    const token = this.token();
    if (this.form.invalid || !token) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.auth.resetPassword({ token, newPassword: this.form.getRawValue().newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, 'Could not reset your password. The link may have expired.'));
      },
    });
  }
}
