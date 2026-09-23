import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TerritoryService } from '../../../core/services/territory.service';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { StateService } from '../../../core/services/state.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { City, Zone } from '../../../core/models/territory.model';
import { State } from '../../../core/models/state.model';

@Component({
  selector: 'app-operations-territory',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
  ],
  templateUrl: './territory.component.html',
  styleUrl: './territory.component.css',
})
export class OperationsTerritoryComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** City creation/activation is a SUPER_ADMIN-only action - see S1's SecurityConfig
   * (`/api/v1/cities/**` non-GET requires SUPER_ADMIN). An Operations Manager is themselves
   * assigned INTO a city and manages Zones/Location Managers within it, but does not create
   * cities. This screen is shared between the admin and operations-manager shells (same
   * component, see app.routes.ts), so the city-management controls are hidden here rather
   * than duplicating the whole component. */
  readonly canManageCities = () => this.auth.role() === 'SUPER_ADMIN';
  readonly isOperationsManager = () => this.auth.role() === 'OPERATIONS_MANAGER';

  /** An Operations Manager only ever browses/creates zones under their own assigned city -
   *  set once resolved via GET /api/v1/operations-managers/by-user/{myUserAccountId}. Left
   *  null for SUPER_ADMIN, who still sees every city. */
  readonly myCityId = signal<string | null>(null);

  readonly cities = signal<City[]>([]);
  readonly citiesLoading = signal(true);
  readonly states = signal<State[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);
  readonly selectedCityId = signal<string | null>(null);

  readonly showCityForm = signal(false);
  readonly savingCity = signal(false);
  readonly cityFormError = signal<string | null>(null);
  readonly showZoneForm = signal(false);
  readonly savingZone = signal(false);
  readonly zoneFormError = signal<string | null>(null);

  readonly cityForm = this.fb.nonNullable.group({
    cityName: ['', [Validators.required]],
    stateId: ['', [Validators.required]],
  });
  readonly zoneForm = this.fb.nonNullable.group({
    zoneName: ['', [Validators.required]],
  });

  constructor(
    private readonly territoryService: TerritoryService,
    private readonly operationsManagerService: OperationsManagerService,
    private readonly stateService: StateService,
    private readonly snackBar: ToastService,
  ) {}

  ngOnInit(): void {
    if (this.canManageCities()) {
      this.stateService.all().subscribe({ next: (list) => this.states.set(list), error: () => {} });
    }
    if (this.isOperationsManager()) {
      const userAccountId = this.auth.userAccountId();
      if (userAccountId) {
        this.operationsManagerService.byUser(userAccountId).subscribe({
          next: (mine) => {
            this.myCityId.set(mine.cityId);
            this.selectedCityId.set(mine.cityId);
            this.loadCities();
            this.loadZonesForCity(mine.cityId);
          },
          error: () => {
            this.loadCities();
            this.loadAllZones();
          },
        });
        return;
      }
    }
    this.loadCities();
    this.loadAllZones();
  }

  private loadCities(): void {
    this.citiesLoading.set(true);
    this.territoryService.cities().subscribe({
      next: (page) => {
        const myCity = this.myCityId();
        this.cities.set(myCity ? page.content.filter((c) => c.id === myCity) : page.content);
        this.citiesLoading.set(false);
      },
      error: () => this.citiesLoading.set(false),
    });
  }

  selectedCityName(): string | undefined {
    return this.cities().find((c) => c.id === this.selectedCityId())?.cityName;
  }

  selectCity(cityId: string): void {
    /* An Operations Manager's own city stays selected at all times - there is only ever one
     * city in their list to toggle, and "deselecting" it would otherwise fall through to
     * loadAllZones(), which is platform-wide and would defeat the whole point of scoping. */
    if (this.myCityId()) {
      this.selectedCityId.set(cityId);
      this.loadZonesForCity(cityId);
      this.showZoneForm.set(false);
      return;
    }
    this.selectedCityId.set(this.selectedCityId() === cityId ? null : cityId);
    this.showZoneForm.set(false);
    if (this.selectedCityId()) {
      this.loadZonesForCity(this.selectedCityId()!);
    } else {
      this.loadAllZones();
    }
  }

  private loadAllZones(): void {
    this.zonesLoading.set(true);
    this.territoryService.zones().subscribe({
      next: (page) => {
        this.zones.set(page.content);
        this.zonesLoading.set(false);
      },
      error: () => this.zonesLoading.set(false),
    });
  }

  private loadZonesForCity(cityId: string): void {
    this.zonesLoading.set(true);
    this.territoryService.zones(cityId).subscribe({
      next: (page) => {
        this.zones.set(page.content);
        this.zonesLoading.set(false);
      },
      error: () => this.zonesLoading.set(false),
    });
  }

  createCity(): void {
    if (this.cityForm.invalid) return;
    this.savingCity.set(true);
    this.cityFormError.set(null);
    this.territoryService.createCity(this.cityForm.getRawValue()).subscribe({
      next: () => {
        this.savingCity.set(false);
        this.showCityForm.set(false);
        this.cityForm.reset({ cityName: '', stateId: '' });
        this.loadCities();
      },
      error: (err) => {
        this.savingCity.set(false);
        this.cityFormError.set(extractErrorMessage(err, 'Could not create this city.'));
      },
    });
  }

  toggleCity(city: City): void {
    this.territoryService.setCityActive(city.id, !city.active).subscribe({
      next: () => this.loadCities(),
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    });
  }

  createZone(): void {
    const cityId = this.selectedCityId();
    if (this.zoneForm.invalid || !cityId) return;
    this.savingZone.set(true);
    this.zoneFormError.set(null);
    this.territoryService.createZone({ cityId, zoneName: this.zoneForm.getRawValue().zoneName }).subscribe({
      next: () => {
        this.savingZone.set(false);
        this.showZoneForm.set(false);
        this.zoneForm.reset({ zoneName: '' });
        this.loadZonesForCity(cityId);
      },
      error: (err) => {
        this.savingZone.set(false);
        this.zoneFormError.set(extractErrorMessage(err, 'Could not create this zone.'));
      },
    });
  }

  toggleZone(zone: Zone): void {
    this.territoryService.setZoneActive(zone.zoneId, !zone.active).subscribe({
      next: () => (this.selectedCityId() ? this.loadZonesForCity(this.selectedCityId()!) : this.loadAllZones()),
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    });
  }
}
