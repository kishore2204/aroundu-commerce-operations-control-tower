import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RetailerService } from '../../../core/services/retailer.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Retailer } from '../../../core/models/retailer.model';
import { City, Zone } from '../../../core/models/territory.model';
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
  selector: 'app-retailer-store',
  standalone: true,
  imports: [ReactiveFormsModule, FormattedInputDirective, FieldHintComponent],
  templateUrl: './store.component.html',
  styleUrl: './store.component.css',
})
export class RetailerStoreComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saved = signal(false);
  private currentStatus = 'PENDING_VERIFICATION';

  readonly cities = signal<City[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);

  /** The stored values as loaded: an unchanged one is not re-checked (it may predate the format rules); a changed one must match. */
  private stored = { registrationNumber: '', gstNumber: '' };

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
    cityId: ['', [Validators.required]],
    zoneId: [''],
    registrationNumber: ['', [unlessUnchanged(() => this.stored.registrationNumber, registrationNumberValidator())]],
    gstNumber: ['', [unlessUnchanged(() => this.stored.gstNumber, gstinValidator())]],
    latitude: [null as number | null],
    longitude: [null as number | null],
    isOpen: [true],
    opensAt: [''],
    closesAt: [''],
  });

  constructor(
    private readonly retailerService: RetailerService,
    private readonly territory: TerritoryService,
  ) {}

  ngOnInit(): void {
    this.territory.cities(true).subscribe({ next: (p) => this.cities.set(p.content), error: () => {} });

    const cached = this.retailerService.myRetailer();
    if (cached) {
      this.populate(cached);
      this.loading.set(false);
      return;
    }
    this.retailerService.resolveMine().subscribe({
      next: (r) => {
        if (r) {
          this.populate(r);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private populate(r: Retailer): void {
    this.currentStatus = r.retailerStatus;
    this.stored = { registrationNumber: r.registrationNumber ?? '', gstNumber: r.gstNumber ?? '' };
    this.form.reset({
      businessName: r.businessName,
      cityId: r.cityId,
      zoneId: r.zoneId ?? '',
      registrationNumber: r.registrationNumber ?? '',
      gstNumber: r.gstNumber ?? '',
      latitude: r.latitude,
      longitude: r.longitude,
      isOpen: r.isOpen,
      opensAt: r.opensAt ?? '',
      closesAt: r.closesAt ?? '',
    });
    if (r.cityId) {
      this.loadZones(r.cityId, r.zoneId ?? '');
    }
  }

  onCityChange(cityId: string): void {
    this.form.patchValue({ zoneId: '' });
    this.zones.set([]);
    if (cityId) this.loadZones(cityId);
  }

  private loadZones(cityId: string, preserveZoneId = ''): void {
    this.zonesLoading.set(true);
    this.territory.zones(cityId, true).subscribe({
      next: (p) => {
        this.zones.set(p.content);
        this.zonesLoading.set(false);
        if (preserveZoneId) this.form.patchValue({ zoneId: preserveZoneId });
      },
      error: () => this.zonesLoading.set(false),
    });
  }

  registrationError(): string | null {
    return identifierError(this.form.controls.registrationNumber, 'registration');
  }

  gstError(): string | null {
    return identifierError(this.form.controls.gstNumber, 'gstin');
  }

  save(): void {
    if (this.form.invalid) return;
    const retailer = this.retailerService.myRetailer();
    if (!retailer) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    const { businessName, cityId, zoneId, registrationNumber, gstNumber, latitude, longitude, isOpen, opensAt, closesAt } =
      this.form.getRawValue();
    this.retailerService
      .update(retailer.retailerId, {
        userAccountId: retailer.userAccountId,
        businessName,
        cityId,
        zoneId: zoneId || null,
        // sent the way the server stores them (upper-case, no spaces)
        registrationNumber: normalizeRegistration(registrationNumber) || null,
        gstNumber: normalizeGstin(gstNumber) || null,
        latitude,
        longitude,
        retailerStatus: this.currentStatus,
        isOpen,
        opensAt: opensAt || null,
        closesAt: closesAt || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractErrorMessage(err, 'Could not save changes.'));
        },
      });
  }
}
