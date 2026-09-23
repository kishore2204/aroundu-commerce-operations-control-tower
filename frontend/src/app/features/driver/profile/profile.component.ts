import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DriverService } from '../../../core/services/driver.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Driver } from '../../../core/models/driver.model';
import {
  identifierError,
  licenceNumberValidator,
  normalizeLicence,
  requiredTrimmed,
  unlessUnchanged,
} from '../../../core/validation/input-rules';
import { FormattedInputDirective } from '../../../shared/input-rules/formatted-input.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';

@Component({
  selector: 'app-driver-profile',
  standalone: true,
  imports: [ReactiveFormsModule, FormattedInputDirective, FieldHintComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class DriverProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly driverService = inject(DriverService);
  protected readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly driver = signal<Driver | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal<string | null>(null);

  /** The licence as loaded: saving it unchanged is never blocked (it may predate the format rule); a changed one must match. */
  private storedLicence = '';

  readonly form = this.fb.nonNullable.group({
    licenseNumber: ['', [requiredTrimmed(), unlessUnchanged(() => this.storedLicence, licenceNumberValidator())]],
    licenseExpiryDate: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.driverService.me().subscribe({
      next: (driver) => {
        this.driver.set(driver);
        this.loading.set(false);
        this.storedLicence = driver.licenseNumber ?? '';
        this.form.patchValue({
          licenseNumber: driver.licenseNumber,
          licenseExpiryDate: driver.licenseExpiryDate,
        });
      },
      error: () => this.loading.set(false),
    });
  }

  licenceError(): string | null {
    return identifierError(this.form.controls.licenseNumber, 'licence');
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    const { licenseNumber, licenseExpiryDate } = this.form.getRawValue();
    // sent the way the server stores it (upper-case, no spaces or hyphens)
    this.driverService.updateMe(normalizeLicence(licenseNumber), licenseExpiryDate).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.saved.set(true);
        this.driver.set(updated);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(extractErrorMessage(err, 'Could not save changes.'));
      },
    });
  }
}
