import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { FleetOwner } from '../../../core/models/fleet-owner.model';

@Component({
  selector: 'app-fleet-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class FleetProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly fleetOwnerService = inject(FleetOwnerService);
  private readonly territoryService = inject(TerritoryService);

  readonly loading = signal(true);
  readonly fleetOwner = signal<FleetOwner | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal<string | null>(null);
  /** Resolved once from cityId/zoneId - the profile page previously showed nothing at all for
   *  a fleet owner's assigned territory. */
  readonly myTerritory = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        this.fleetOwner.set(owner);
        this.loading.set(false);
        if (owner) {
          this.form.patchValue({ businessName: owner.businessName ?? '' });
          this.loadTerritory(owner);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTerritory(owner: FleetOwner): void {
    if (!owner.cityId) return;
    this.territoryService.cities().subscribe({
      next: (cityPage) => {
        const cityName = cityPage.content.find((c) => c.id === owner.cityId)?.cityName ?? 'Unknown city';
        if (!owner.zoneId) {
          this.myTerritory.set(cityName);
          return;
        }
        this.territoryService.zones(owner.cityId).subscribe({
          next: (zonePage) => {
            const zoneName = zonePage.content.find((z) => z.zoneId === owner.zoneId)?.zoneName ?? 'Unknown zone';
            this.myTerritory.set(`${cityName} · ${zoneName}`);
          },
          error: () => this.myTerritory.set(cityName),
        });
      },
      error: () => {},
    });
  }

  save(): void {
    const owner = this.fleetOwner();
    if (!owner || this.form.invalid) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    const { businessName } = this.form.getRawValue();
    this.fleetOwnerService
      .update(owner.fleetOwnerId, {
        userAccountId: owner.userAccountId,
        cityId: owner.cityId,
        zoneId: owner.zoneId,
        businessName,
        profileStatus: owner.profileStatus,
        ownerStatus: owner.ownerStatus,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.saved.set(true);
          this.fleetOwner.set(updated);
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractErrorMessage(err, 'Could not save changes.'));
        },
      });
  }
}
