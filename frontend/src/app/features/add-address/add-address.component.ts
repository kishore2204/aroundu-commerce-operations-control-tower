import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AddressListComponent } from '../addresses/address-list.component';
import { CustomerZoneService } from '../../core/services/customer-zone.service';
import { Address } from '../../core/models/address.model';

/**
 * Post-login gate for a customer with no saved address - blocks every other Commerce Customer
 * page (see addressRequiredGuard) until one exists, since zone-based product/retailer
 * availability everywhere else depends on having one.
 */
@Component({
  selector: 'app-add-address',
  standalone: true,
  imports: [AddressListComponent],
  templateUrl: './add-address.component.html',
  styleUrl: './add-address.component.css',
})
export class AddAddressComponent {
  private readonly zone = inject(CustomerZoneService);
  private readonly router = inject(Router);

  onAddressSelected(address: Address): void {
    this.zone.setInitial(address);
    this.router.navigateByUrl('/home');
  }
}
