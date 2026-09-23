import { Component, Input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { RetailerService } from '../../core/services/retailer.service';
import { FleetOwnerService } from '../../core/services/fleet-owner.service';
import { SupportService } from '../../core/services/notification.service';
import { SupportTicket } from '../../core/models/notification.model';
import { categoryLabel } from '../../core/models/support-ticket-categories';
import { slaLabel, slaState } from './support-sla.util';

/**
 * A retailer's/fleet owner's own "escalated to me" queue - tickets S6 has escalated directly to
 * their business (SupportTicket.escalatedToEntityType/Id), not tickets they raised themselves
 * (see MyTicketsComponent for that). Reused by both retailer/escalations and fleet/escalations
 * via the two thin wrapper components below, parameterized by entityType so the list-rendering
 * isn't duplicated.
 */
@Component({
  selector: 'app-entity-ticket-queue',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './entity-ticket-queue.component.html',
  styleUrl: './entity-ticket-queue.component.css',
})
export class EntityTicketQueueComponent implements OnInit {
  @Input({ required: true }) entityType!: 'RETAILER' | 'FLEET_OWNER';

  readonly categoryLabel = categoryLabel;
  readonly slaLabel = slaLabel;
  readonly slaState = slaState;

  readonly tickets = signal<SupportTicket[]>([]);
  readonly loading = signal(true);

  /** This component is mounted at /retailer/escalations and /fleet/escalations, but the
   *  shared ticket-detail route lives at /retailer/support/:id and /fleet/support/:id
   *  respectively (see app.routes.ts) - not a sibling of this route, so the link is built
   *  absolute rather than relative. */
  detailPath(ticketId: string): string[] {
    return this.entityType === 'RETAILER' ? ['/retailer', 'support', ticketId] : ['/fleet', 'support', ticketId];
  }

  constructor(
    private readonly retailerService: RetailerService,
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly supportService: SupportService,
  ) {}

  ngOnInit(): void {
    if (this.entityType === 'RETAILER') {
      this.retailerService.resolveMine().subscribe({
        next: (mine) => this.loadFor(mine?.retailerId ?? null),
        error: () => this.loading.set(false),
      });
    } else {
      this.fleetOwnerService.resolveMine().subscribe({
        next: (mine) => this.loadFor(mine?.fleetOwnerId ?? null),
        error: () => this.loading.set(false),
      });
    }
  }

  private loadFor(entityId: string | null): void {
    if (!entityId) {
      this.loading.set(false);
      return;
    }
    this.supportService.escalatedToEntity(this.entityType, entityId).subscribe({
      next: (list) => {
        this.tickets.set(list.sort((a, b) => (b.escalatedAt ?? '').localeCompare(a.escalatedAt ?? '')));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
