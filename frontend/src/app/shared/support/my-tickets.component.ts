import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { SupportService } from '../../core/services/notification.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { SupportTicket } from '../../core/models/notification.model';
import { Order } from '../../core/models/order.model';
import { categoriesForRole, categoryLabel } from '../../core/models/support-ticket-categories';

/** Categories where "which order is this about" is actually meaningful - the order picker only
 *  ever shows for these, and only for CUSTOMER (the only role whose orderId gets ownership-
 *  validated server-side, see SupportTicketServiceImpl.createSupportTicket). */
const ORDER_LINKED_CATEGORIES = new Set(['ORDER_ISSUE', 'RETURN_REFUND', 'DELIVERY_ISSUE']);

/** A light nudge, not a rule - the priority select stays fully editable after this fires.
 *  Keyed on top-level category codes across every role's taxonomy (support-ticket-categories.ts). */
const SUGGESTED_PRIORITY: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  ORDER_ISSUE: 'HIGH',
  PAYMENT_ISSUE: 'HIGH',
  DELIVERY_ISSUE: 'MEDIUM',
  RETURN_REFUND: 'MEDIUM',
  ACCOUNT_ISSUE: 'MEDIUM',
  ORDER_MANAGEMENT: 'MEDIUM',
  PAYOUT_SETTLEMENT: 'HIGH',
  PRODUCT_LISTING: 'LOW',
  ACCOUNT_VERIFICATION: 'MEDIUM',
  VEHICLE_ISSUE: 'HIGH',
  DRIVER_ISSUE: 'MEDIUM',
  ASSIGNMENT_ISSUE: 'MEDIUM',
  PAYMENT_EXPENSE: 'HIGH',
  PAYOUT_ISSUE: 'HIGH',
  TRIP_ISSUE: 'MEDIUM',
  SAFETY_CONDUCT: 'HIGH',
  ZONE_OPERATIONS: 'MEDIUM',
  SYSTEM_TECHNICAL: 'MEDIUM',
  APP_TECHNICAL: 'MEDIUM',
};

/**
 * Raise-a-ticket + "my tickets" list, reused across every non-staff portal (customer's profile,
 * retailer, fleet manager) and by staff roles raising a ticket about their own internal issue
 * (operations/location/admin/support-staff queues embed this too). Category/subcategory options
 * come from support-ticket-categories.ts, keyed by the current user's role - the same taxonomy
 * S6 validates against server-side.
 */
@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [DatePipe, RouterLink, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.css',
})
export class MyTicketsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly categoryLabel = categoryLabel;
  readonly tickets = signal<SupportTicket[]>([]);
  readonly ticketsLoading = signal(true);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly categories = signal<Record<string, string[]>>({});
  readonly subcategoryOptions = signal<string[]>([]);
  readonly orderOptions = signal<Order[]>([]);
  readonly showOrderPicker = signal(false);

  private customerProfileId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    ticketCategory: ['', Validators.required],
    ticketSubCategory: ['', Validators.required],
    orderId: [''],
    subject: ['', Validators.required],
    description: ['', Validators.required],
    priority: ['MEDIUM', Validators.required],
  });

  constructor(
    private readonly auth: AuthService,
    private readonly customerService: CustomerService,
    private readonly orderService: OrderService,
    private readonly supportService: SupportService,
  ) {}

  ngOnInit(): void {
    const role = this.auth.role();
    this.categories.set(role ? categoriesForRole(role) : {});
    if (role === 'CUSTOMER') {
      this.customerService.me().subscribe({
        next: (profile) => (this.customerProfileId = profile.id),
        error: () => {},
      });
      this.loadOrderOptions();
    }
    this.load();
  }

  categoryKeys(): string[] {
    return Object.keys(this.categories());
  }

  onCategoryChange(category: string): void {
    this.subcategoryOptions.set(this.categories()[category] ?? []);
    this.showOrderPicker.set(ORDER_LINKED_CATEGORIES.has(category));
    const suggested = SUGGESTED_PRIORITY[category];
    this.form.patchValue({ ticketSubCategory: '', orderId: '', ...(suggested ? { priority: suggested } : {}) });
  }

  openForm(): void {
    this.formOpen.set(true);
  }

  /** Resolves this customer's remembered order ids (see OrderService.myOrderIds - there's no
   *  server-side "list my orders" endpoint) to full orders, so the order picker can show order
   *  numbers instead of raw ids. Best-effort per order: a lookup failure just drops that one. */
  private loadOrderOptions(): void {
    const ids = this.orderService.myOrderIds();
    if (ids.length === 0) return;
    forkJoin(ids.map((id) => this.orderService.get(id).pipe(catchError(() => of(null))))).subscribe((orders) => {
      this.orderOptions.set(orders.filter((o): o is Order => o !== null));
    });
  }

  private load(): void {
    this.ticketsLoading.set(true);
    this.supportService.mine().subscribe({
      next: (list) => {
        this.tickets.set(list.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)));
        this.ticketsLoading.set(false);
      },
      error: () => this.ticketsLoading.set(false),
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const userAccountId = this.auth.userAccountId();
    const role = this.auth.role();
    if (!userAccountId || !role) return;
    if (role === 'CUSTOMER' && !this.customerProfileId) {
      this.saveError.set('Could not identify your customer profile - please try again shortly.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    const { ticketCategory, ticketSubCategory, orderId, subject, description, priority } = this.form.getRawValue();
    const ticketNumber = 'TCK-' + Date.now().toString().slice(-8);
    this.supportService
      .create({
        customerProfileId: role === 'CUSTOMER' ? this.customerProfileId : null,
        orderId: orderId ? Number(orderId) : null,
        raisedByAccountId: userAccountId,
        raisedByRole: role,
        ticketCategory,
        ticketSubCategory,
        ticketNumber,
        subject,
        description,
        priority,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.form.reset({ ticketCategory: '', ticketSubCategory: '', orderId: '', subject: '', description: '', priority: 'MEDIUM' });
          this.subcategoryOptions.set([]);
          this.showOrderPicker.set(false);
          this.load();
        },
        error: (err) => {
          this.saving.set(false);
          this.saveError.set(extractErrorMessage(err, 'Could not raise this ticket.'));
        },
      });
  }
}
