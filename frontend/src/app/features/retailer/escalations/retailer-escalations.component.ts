import { Component } from '@angular/core';
import { EntityTicketQueueComponent } from '../../../shared/support/entity-ticket-queue.component';

@Component({
  selector: 'app-retailer-escalations',
  standalone: true,
  imports: [EntityTicketQueueComponent],
  template: `<app-entity-ticket-queue entityType="RETAILER" />`,
})
export class RetailerEscalationsComponent {}
