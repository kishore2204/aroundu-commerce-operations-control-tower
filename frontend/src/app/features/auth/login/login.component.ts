import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { landingRouteFor } from '../../../core/auth/role-landing';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { ToastService } from '../../../shared/toast/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly sessionExpired = signal(false);
  readonly showPassword = signal(false);
  readonly currentYear = new Date().getFullYear();

  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    route: ActivatedRoute,
  ) {
    this.sessionExpired.set(route.snapshot.queryParamMap.get('sessionExpired') === 'true');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show(this.firstValidationMessage(), 'error');
      return;
    }
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.getRawValue();
    // Surrounding spaces are never part of an email address (a phone keyboard / autofill often adds one).
    this.auth.login({ email: email.trim(), password }).subscribe({
      next: (response) => {
        // Stay in the busy state until the landing page has actually opened: the route guards of the landing
        // page (address, retailer/fleet profile ...) make their own requests, and re-enabling the button before
        // that made the sign-in look finished/failed for a few seconds and invited a second click.
        this.router.navigate(landingRouteFor(response.role)).finally(() => this.loading.set(false));
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(extractErrorMessage(err, 'Could not sign in. Check your email and password.'));
      },
    });
  }

  private firstValidationMessage(): string {
    const email = this.form.controls.email;
    if (email.hasError('required')) return 'Please enter your email address.';
    if (email.hasError('email')) return 'Please enter a valid email address.';
    if (this.form.controls.password.hasError('required')) return 'Please enter your password.';
    return 'Please fill in all required fields correctly.';
  }
}
