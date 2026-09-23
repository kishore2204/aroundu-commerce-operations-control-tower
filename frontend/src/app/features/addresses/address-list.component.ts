import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { AddressService } from '../../core/services/address.service';
import { TerritoryService } from '../../core/services/territory.service';
import { StateService } from '../../core/services/state.service';
import { CustomerZoneService } from '../../core/services/customer-zone.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { Address } from '../../core/models/address.model';
import { City, Zone } from '../../core/models/territory.model';
import { State } from '../../core/models/state.model';
import { CartService } from '../../core/services/cart.service';
import { DigitsOnlyDirective } from '../../shared/input-rules/digits-only.directive';
import { FieldHintComponent } from '../../shared/field-hint/field-hint.component';
import { postalCodeValidator } from '../../core/validation/input-rules';

@Component({
  selector: 'app-address-list',
  standalone: true,
  imports: [DigitsOnlyDirective, FieldHintComponent, ReactiveFormsModule, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './address-list.component.html',
  styleUrl: './address-list.component.css',
})
export class AddressListComponent implements OnInit {
  /** When used inside checkout/cart, hides the page title but keeps full functionality. */
  @Input() embedded = false;
  /**
   * Fired whenever an address row is clicked (not just "Set default") - lets a host like
   * CartAddressSelectorComponent run a serviceability check against the candidate address
   * before deciding whether to actually persist it as default, without this component needing
   * to know anything about serviceability itself.
   */
  @Output() readonly addressSelected = new EventEmitter<Address>();

  readonly addresses = signal<Address[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  /** The address awaiting a delete confirmation - replaces firing the delete immediately on click. */
  readonly pendingDelete = signal<Address | null>(null);
  readonly deleting = signal(false);

  /** Backs the city/zone dropdowns - the backend still takes cityName/zoneName as plain
   * strings (resolved to S1 territory ids server-side), so these lists are only for
   * presenting valid choices, not for the request payload itself. */
  readonly states = signal<State[]>([]);
  readonly cities = signal<City[]>([]);
  readonly filteredCities = signal<City[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);
  private selectedCityId: string | null = null;

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    addressTag: ['HOME', [Validators.required]],
    stateId: ['', [Validators.required]],
    cityName: ['', [Validators.required]],
    zoneName: ['', [Validators.required]],
    line1: ['', [Validators.required]],
    line2: [''],
    postalCode: ['', [postalCodeValidator()]],
    defaultAddress: [false],
  });

  constructor(
    private readonly addressService: AddressService,
    private readonly territory: TerritoryService,
    private readonly stateService: StateService,
    private readonly zone: CustomerZoneService,
    private readonly snackBar: ToastService,
    private readonly cartService: CartService,
  ) {}

  ngOnInit(): void {
    this.stateService.all().subscribe({ next: (list) => this.states.set(list.filter((state) => state.isActive)), error: () => {} });
    this.territory.cities(true).subscribe({
      next: (page) => {
        this.cities.set(page.content);
        const selectedStateId = this.form.controls.stateId.value;
        this.filteredCities.set(selectedStateId ? page.content.filter((city) => city.stateId === selectedStateId) : []);
      },
      error: () => {},
    });
    this.load();
  }

  onStateChange(stateId: string, preserveCity = false): void {
    if (!preserveCity) {
      this.form.patchValue({ cityName: '', zoneName: '' });
      this.zones.set([]);
      this.selectedCityId = null;
    }
    this.filteredCities.set(stateId ? this.cities().filter((city) => city.stateId === stateId) : []);
  }

  /** `preserveZone` is only true when pre-loading an existing address's zone list in edit() -
   * a real user picking a different city should always clear the now-stale zone selection. */
  onCityChange(cityName: string, preserveZone = false): void {
    if (!preserveZone) this.form.patchValue({ zoneName: '' });
    this.zones.set([]);
    const city = this.cities().find((c) => c.cityName === cityName);
    this.selectedCityId = city?.id ?? null;
    if (!this.selectedCityId) return;
    this.zonesLoading.set(true);
    this.territory.zones(this.selectedCityId, true).subscribe({
      next: (p) => {
        this.zones.set(p.content);
        this.zonesLoading.set(false);
      },
      error: () => this.zonesLoading.set(false),
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.addressService.list(0, 50).subscribe({
      next: (page) => {
        this.addresses.set(page.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Could not load your addresses.'));
      },
    });
  }

  startAdd(): void {
    this.editingId.set(null);
    this.form.reset({ addressTag: 'HOME', stateId: '', cityName: '', zoneName: '', line1: '', line2: '', postalCode: '', defaultAddress: false });
    this.filteredCities.set([]);
    this.zones.set([]);
    this.selectedCityId = null;
    this.formError.set(null);
    this.showForm.set(true);
  }

  edit(event: Event, address: Address): void {
    event.stopPropagation();
    this.editingId.set(address.id);
    const existingCity = this.cities().find((city) => city.cityName === address.cityName);
    const stateId = existingCity?.stateId ?? '';
    this.onStateChange(stateId, true);
    this.form.reset({
      addressTag: address.addressTag,
      stateId,
      cityName: address.cityName,
      zoneName: address.zoneName ?? '',
      line1: address.line1,
      line2: address.line2 ?? '',
      postalCode: address.postalCode ?? '',
      defaultAddress: address.defaultAddress,
    });
    if (address.cityName) this.onCityChange(address.cityName, true);
    this.formError.set(null);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  /** Saving (create or edit) an address that is/becomes the default must update the shared
   *  `CustomerZoneService` signal too - previously this called AddressService directly, so the
   *  header label and every zone-reactive page (product list, etc.) stayed stale until a full
   *  reload even though the new default had actually persisted. */
  save(): void {
    if (this.form.invalid) return;
    const activeId = this.zone.activeAddress()?.id;
    const editingActive = !!this.editingId() && this.editingId() === activeId;
    const selectingAsDefault = this.form.controls.defaultAddress.value && this.editingId() !== activeId;
    if (this.cartService.itemCount() > 0 && (editingActive || selectingAsDefault)) {
      this.formError.set("You can't switch or edit your active delivery address while your cart contains items. Please clear your cart before changing the address.");
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    const { stateId: _stateId, postalCode, ...rest } = this.form.getRawValue();
    const request = { ...rest, postalCode: postalCode.trim() ? postalCode.trim() : null };
    const id = this.editingId();
    const call = id ? this.addressService.update(id, request) : this.addressService.create(request);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.showForm.set(false);
        if (request.defaultAddress || saved.id === this.zone.activeAddress()?.id) {
          this.zone.syncActive(saved);
        }
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not save this address.'));
      },
    });
  }

  selectAddress(address: Address): void {
    this.addressSelected.emit(address);
  }

  setDefault(event: Event, address: Address): void {
    event.stopPropagation();
    if (address.defaultAddress) return;
    if (this.cartService.itemCount() > 0) {
      this.snackBar.show("You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.", 'warning');
      return;
    }
    this.addressService.setDefault(address.id).subscribe({
      next: (updated) => {
        this.zone.syncActive(updated);
        this.load();
      },
      error: (err) => this.snackBar.show(extractErrorMessage(err), 'error'),
    });
  }

  /** Opens the confirmation dialog instead of deleting immediately - deleting a saved address is
   *  not undoable from this screen. */
  remove(event: Event, address: Address): void {
    event.stopPropagation();
    this.pendingDelete.set(address);
  }

  confirmDelete(): void {
    const address = this.pendingDelete();
    if (!address || this.deleting()) return;
    this.deleting.set(true);
    this.addressService.remove(address.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.snackBar.show('Address deleted.', 'success');
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.snackBar.show(extractErrorMessage(err, 'Could not delete this address.'), 'error');
      },
    });
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.pendingDelete.set(null);
  }
}
