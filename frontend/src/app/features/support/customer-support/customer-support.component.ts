import { Component } from '@angular/core';
import { MyTicketsComponent } from '../../../shared/support/my-tickets.component';

@Component({
  selector: 'app-customer-support', standalone: true, imports: [MyTicketsComponent],
  templateUrl: './customer-support.component.html', styleUrl: './customer-support.component.css',
})
export class CustomerSupportComponent {}
