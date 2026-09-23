import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RetailerService } from '../../../core/services/retailer.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Retailer } from '../../../core/models/retailer.model';
import {
  gstinValidator,
  identifierError,
  normalizeGstin,
  normalizeRegistration,
  registrationNumberValidator,
  unlessUnchanged,
} from '../../../core/validation/input-rules';
import { FormattedInputDirective } from '../../../shared/input-rules/formatted-input.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';

@Component({
  selector: 'app-retailer-profile',
  standalone: true,
  imports: [ReactiveFormsModule, FormattedInputDirective, FieldHintComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class RetailerProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly retailerService = inject(RetailerService);

  readonly loading = signal(true);
  readonly retailer = signal<Retailer | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal<string | null>(null);

  /** The stored values as loaded: an unchanged one is not re-checked (it may predate the format rules); a changed one must match. */
  private stored = { registrationNumber: '', gstNumber: '' };

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
    registrationNumber: ['', [unlessUnchanged(() => this.stored.registrationNumber, registrationNumberValidator())]],
    gstNumber: ['', [unlessUnchanged(() => this.stored.gstNumber, gstinValidator())]],
    isOpen: [true],
    opensAt: [''],
    closesAt: [''],
  });

  ngOnInit(): void {
    this.retailerService.resolveMine().subscribe({
      next: (retailer) => {
        this.retailer.set(retailer);
        this.loading.set(false);
        if (retailer) {
          this.stored = { registrationNumber: retailer.registrationNumber ?? '', gstNumber: retailer.gstNumber ?? '' };
          this.form.patchValue({
            businessName: retailer.businessName,
            registrationNumber: retailer.registrationNumber ?? '',
            gstNumber: retailer.gstNumber ?? '',
            isOpen: retailer.isOpen,
            opensAt: retailer.opensAt ?? '',
            closesAt: retailer.closesAt ?? '',
          });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  registrationError(): string | null {
    return identifierError(this.form.controls.registrationNumber, 'registration');
  }

  gstError(): string | null {
    return identifierError(this.form.controls.gstNumber, 'gstin');
  }

  save(): void {
    const retailer = this.retailer();
    if (!retailer || this.form.invalid) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    const { businessName, registrationNumber, gstNumber, isOpen, opensAt, closesAt } = this.form.getRawValue();
    this.retailerService
      .update(retailer.retailerId, {
        userAccountId: retailer.userAccountId,
        cityId: retailer.cityId,
        zoneId: retailer.zoneId,
        businessName,
        // sent the way the server stores them (upper-case, no spaces)
        registrationNumber: normalizeRegistration(registrationNumber) || null,
        gstNumber: normalizeGstin(gstNumber) || null,
        retailerStatus: retailer.retailerStatus,
        isOpen,
        opensAt: opensAt || null,
        closesAt: closesAt || null,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.saved.set(true);
          this.retailer.set(updated);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractErrorMessage(err, 'Could not save changes.'));
        },
      });
  }
}
