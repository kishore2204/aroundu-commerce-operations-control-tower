import { Component, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TerritoryService } from '../../../core/services/territory.service';
import { City, Zone } from '../../../core/models/territory.model';

@Component({
  selector: 'app-location-territory',
  standalone: true,
  imports: [EmptyStateComponent],
  templateUrl: './territory.component.html',
  styleUrl: './territory.component.css',
})
export class LocationTerritoryComponent implements OnInit {
  readonly cities = signal<City[]>([]);
  readonly citiesLoading = signal(true);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);
  readonly selectedCityId = signal<string | null>(null);

  constructor(private readonly territoryService: TerritoryService) {}

  ngOnInit(): void {
    this.territoryService.cities().subscribe({
      next: (page) => {
        this.cities.set(page.content);
        this.citiesLoading.set(false);
      },
      error: () => this.citiesLoading.set(false),
    });
    this.loadAllZones();
  }

  selectedCityName(): string | undefined {
    return this.cities().find((c) => c.id === this.selectedCityId())?.cityName;
  }

  selectCity(cityId: string): void {
    this.selectedCityId.set(this.selectedCityId() === cityId ? null : cityId);
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
}
