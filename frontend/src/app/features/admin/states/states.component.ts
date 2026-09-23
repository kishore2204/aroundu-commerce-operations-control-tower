import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { StateService } from '../../../core/services/state.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { State } from '../../../core/models/state.model';
import { City } from '../../../core/models/territory.model';

@Component({
  selector: 'app-admin-states',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './states.component.html',
  styleUrl: './states.component.css',
})
export class AdminStatesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly states = signal<State[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  /** Cities under the currently expanded state - fetched once and filtered client-side per
   *  click (same "fetch all + filter" pattern already used across this codebase for small
   *  reference-data lists, see FleetOwnerService.resolveMine()). */
  readonly expandedStateId = signal<string | null>(null);
  readonly allCities = signal<City[]>([]);
  readonly citiesLoading = signal(false);
  readonly citiesForExpandedState = (): City[] => this.allCities().filter((c) => c.stateId === this.expandedStateId());

  /** All Indian states + union territories - a fixed dropdown avoids duplicate/misspelled
   * entries (e.g. "Tamilnadu" vs "Tamil Nadu") that free text invited. */
  readonly indianStatesAndTerritories = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
    'Lakshadweep', 'Puducherry',
  ];

  /** This platform only operates in India today (see seed data / docs) - a short fixed list
   * keeps the field a dropdown rather than free text, with room to add a country later. */
  readonly countries = [{ code: 'IN', name: 'India' }];

  readonly form = this.fb.nonNullable.group({
    stateName: ['', [Validators.required]],
    countryCode: ['IN', [Validators.required, Validators.pattern(/^[A-Za-z]{2,10}$/)]],
  });

  constructor(
    private readonly stateService: StateService,
    private readonly territoryService: TerritoryService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.stateService.all().subscribe({
      next: (states) => {
        this.states.set(states.sort((a, b) => a.stateName.localeCompare(b.stateName)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    this.stateService.create({ ...this.form.getRawValue(), isActive: true }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form.reset({ stateName: '', countryCode: 'IN' });
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not create this state.'));
      },
    });
  }

  toggleExpand(state: State): void {
    if (this.expandedStateId() === state.id) {
      this.expandedStateId.set(null);
      return;
    }
    this.expandedStateId.set(state.id);
    if (this.allCities().length === 0) {
      this.citiesLoading.set(true);
      this.territoryService.cities().subscribe({
        next: (page) => {
          this.allCities.set(page.content);
          this.citiesLoading.set(false);
        },
        error: () => this.citiesLoading.set(false),
      });
    }
  }

  toggle(state: State): void {
    this.stateService.update(state.id, { stateName: state.stateName, countryCode: state.countryCode, isActive: !state.isActive }).subscribe({
      next: () => this.load(),
      error: (err) => this.showToast(extractErrorMessage(err)),
    });
  }
}
