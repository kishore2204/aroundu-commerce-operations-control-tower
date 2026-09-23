import { Injectable, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { AddressService } from './address.service';
import { Address } from '../models/address.model';

/**
 * The customer's single "active" delivery address/zone, shared across every Commerce Customer
 * page - the source of truth for zone-based catalogue filtering (see ProductService.search's
 * zoneId param) and for the header's address display. Loaded once per session; changing the
 * active address (header "Change Address", or checkout picking a different one) updates this
 * signal so every page reading it re-renders immediately, no reload.
 *
 * The address can only be changed from the Header or the Profile's Addresses tab - Checkout
 * itself is read-only (shows whichever address this signal currently holds, with no picker),
 * per the requirement that a per-order address override is not offered.
 */
@Injectable({ providedIn: 'root' })
export class CustomerZoneService {
  readonly activeAddress = signal<Address | null>(null);
  readonly loading = signal(true);
  /** True once the initial load has completed and there is definitively no saved address -
   *  drives the post-login "add an address first" gate. */
  readonly hasNoAddress = signal(false);

  constructor(private readonly addressService: AddressService) {}

  load(): Observable<Address | null> {
    this.loading.set(true);
    return this.addressService.getDefault().pipe(
      tap((address) => {
        this.activeAddress.set(address);
        this.hasNoAddress.set(false);
        this.loading.set(false);
      }),
      catchError(() => {
        this.activeAddress.set(null);
        this.hasNoAddress.set(true);
        this.loading.set(false);
        return of(null);
      }),
    );
  }

  /** Makes `address` the customer's active delivery address platform-wide (not just for one
   *  checkout) - sets it as their default and updates the shared signal immediately. */
  setActive(address: Address): Observable<Address> {
    return this.addressService.setDefault(address.id).pipe(
      tap((updated) => {
        this.activeAddress.set(updated);
        this.hasNoAddress.set(false);
      }),
    );
  }

  /** Called right after a customer adds their very first address (the post-login gate). */
  setInitial(address: Address): void {
    this.activeAddress.set(address);
    this.hasNoAddress.set(false);
  }

  /** Syncs the shared signal to an address the caller already knows is the (new) default -
   *  e.g. AddressListComponent's own setDefault()/save() calls, which already made the server
   *  call themselves. Avoids a redundant second PUT .../default that setActive() would trigger. */
  syncActive(address: Address): void {
    this.activeAddress.set(address);
    this.hasNoAddress.set(false);
  }

  currentZoneId(): string | null {
    return this.activeAddress()?.zoneId ?? null;
  }
}
