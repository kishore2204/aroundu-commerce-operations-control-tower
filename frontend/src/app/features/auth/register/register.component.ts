import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { ToastService } from '../../../shared/toast/toast.service';
import { DigitsOnlyDirective } from '../../../shared/input-rules/digits-only.directive';
import { PasswordRequirementsComponent } from '../../../shared/password-requirements/password-requirements.component';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  EMAIL_TOO_LONG_MESSAGE,
  MOBILE_NUMBER_MESSAGE,
  emailValidator,
  mobileNumberValidator,
  normalizeEmail,
  requiredTrimmed,
} from '../../../core/validation/input-rules';

/** What the server says when the address is already registered (S1 EmailRule.DUPLICATE_MESSAGE). */
const EMAIL_DUPLICATE_MESSAGE = 'An account already exists with this email address.';

type FieldName = 'firstName' | 'lastName' | 'email' | 'phoneNumber' | 'password' | 'confirmPassword' | 'agreeTerms';
import { PASSWORD_MAX_LENGTH, passwordPolicyValidator } from '../../../core/validation/password-policy';

const passwordsMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [DigitsOnlyDirective, PasswordRequirementsComponent, FieldHintComponent, 
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly success = signal(false);
  readonly termsOpen = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly currentYear = new Date().getFullYear();

  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [requiredTrimmed(), Validators.maxLength(100)]],
    lastName: ['', [requiredTrimmed(), Validators.maxLength(100)]],
    email: ['', [requiredTrimmed(), emailValidator(), Validators.maxLength(EMAIL_MAX_LENGTH)]],
    phoneNumber: ['', [requiredTrimmed(), mobileNumberValidator()]],
    password: ['', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
    confirmPassword: ['', [Validators.required]],
    role: ['CUSTOMER' as 'CUSTOMER' | 'RETAILER' | 'FLEET_MANAGER', [Validators.required]],
    agreeTerms: [false, [Validators.requiredTrue]],
  }, { validators: passwordsMatchValidator });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  selectRole(role: 'CUSTOMER' | 'RETAILER' | 'FLEET_MANAGER'): void {
    this.form.patchValue({ role });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show(this.firstValidationMessage(), 'error');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    const { agreeTerms, confirmPassword: _confirmPassword, ...rest } = this.form.getRawValue();
    // surrounding spaces are never part of a name or an address
    const request = { ...rest, firstName: rest.firstName.trim(), lastName: rest.lastName.trim(), email: normalizeEmail(rest.email), termsAccepted: agreeTerms };
    this.auth.register(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/login']), 1200);
      },
      error: (err) => {
        this.loading.set(false);
        const message = extractErrorMessage(err, 'Could not create your account. Please check your details.');
        this.errorMessage.set(message);
        if (message === EMAIL_DUPLICATE_MESSAGE) {
          // show it under the field as well: that is the value to change
          this.form.controls.email.setErrors({ duplicate: true });
          this.form.controls.email.markAsTouched();
        }
      },
    });
  }

  /**
   * The message to show under a field - only once the user has touched (left) or typed in it, or tried to submit
   * (submit marks every field touched), so an untouched form does not open covered in errors.
   */
  fieldError(name: FieldName): string | null {
    const control = this.form.controls[name];
    if (!(control.touched || control.dirty)) return null;
    switch (name) {
      case 'firstName':
        return control.hasError('required') ? 'First name is required.' : control.hasError('maxlength') ? 'First name must not exceed 100 characters.' : null;
      case 'lastName':
        return control.hasError('required') ? 'Last name is required.' : control.hasError('maxlength') ? 'Last name must not exceed 100 characters.' : null;
      case 'email':
        if (control.hasError('required')) return EMAIL_REQUIRED_MESSAGE;
        if (control.hasError('email')) return EMAIL_MESSAGE;
        if (control.hasError('maxlength')) return EMAIL_TOO_LONG_MESSAGE;
        return control.hasError('duplicate') ? EMAIL_DUPLICATE_MESSAGE : null;
      case 'phoneNumber':
        if (control.hasError('required')) return 'Mobile number is required.';
        return control.hasError('mobileNumber') ? `${MOBILE_NUMBER_MESSAGE}.` : null;
      case 'password':
        if (control.hasError('required')) return 'Password is required.';
        return control.hasError('passwordPolicy') ? 'Password must meet all the requirements listed below.' : null;
      case 'confirmPassword':
        return control.hasError('required') ? 'Confirm your password.' : null;
      case 'agreeTerms':
        return control.hasError('required') ? 'Accept the Terms and Conditions to continue.' : null;
    }
  }

  private firstValidationMessage(): string {
    const order: FieldName[] = ['firstName', 'lastName', 'email', 'phoneNumber', 'password', 'confirmPassword', 'agreeTerms'];
    for (const name of order) {
      const message = this.fieldError(name);
      if (message) return message;
    }
    if (this.form.hasError('passwordMismatch')) return 'Passwords do not match.';
    return 'Please fill in all required fields correctly.';
  }
}
