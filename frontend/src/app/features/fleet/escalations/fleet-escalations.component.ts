import { Component } from '@angular/core';
import { EntityTicketQueueComponent } from '../../../shared/support/entity-ticket-queue.component';

@Component({
  selector: 'app-fleet-escalations',
  standalone: true,
  imports: [EntityTicketQueueComponent],
  template: `<app-entity-ticket-queue entityType="FLEET_OWNER" />`,
})
export class FleetEscalationsComponent {}
