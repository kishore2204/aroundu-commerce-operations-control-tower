import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { SpringPage } from '../api/api-response';
import { ProductService } from './product.service';
import {
  CreateOrderRequest,
  Order,
  OrderItem,
  OrderTracking,
  OrderTrackingGroup,
  PaymentTransaction,
  PaymentTransactionRequest,
  RetailerRejectRequest,
} from '../models/order.model';

const MY_ORDER_IDS_KEY = 'aroundu.myOrderIds';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(
    private readonly http: HttpClient,
    private readonly products: ProductService,
  ) {}

  create(order: CreateOrderRequest): Observable<Order> {
    // Plain JSON, no ApiResponse envelope - S4 does not use S3's wrapper.
    return this.http.post<Order>('/api/orders', order);
  }

  addItem(item: OrderItem): Observable<OrderItem> {
    return this.http.post<OrderItem>('/api/order-items', item);
  }

  /** This order's line items (product names, quantities, prices) - see OrderItemController. */
  itemsForOrder(orderId: number): Observable<OrderItem[]> {
    return this.http.get<OrderItem[]>(`/api/order-items/by-order/${orderId}`);
  }

  /** The line items of several orders in ONE request (each item carries its orderId) - the order list used to send one
   *  request per order. At most 100 orders per call. */
  itemsForOrders(orderIds: number[]): Observable<OrderItem[]> {
    if (orderIds.length === 0) return of([]);
    return this.http.get<OrderItem[]>('/api/order-items/by-orders', { params: new HttpParams().set('ids', orderIds.join(',')) });
  }

  get(id: number): Observable<Order> {
    return this.http.get<Order>(`/api/orders/${id}`);
  }

  getTracking(id: number): Observable<OrderTracking> {
    return this.http.get<OrderTracking>(`/api/orders/${id}/tracking`);
  }

  /** Tracking for every shop-specific order from the same checkout as `id`, in one request. */
  getTrackingGroup(id: number): Observable<OrderTrackingGroup> {
    return this.http.get<OrderTrackingGroup>(`/api/orders/${id}/tracking-group`);
  }

  /**
   * Moves a freshly-created order from NEW to WAITING_FOR_RETAILER, starting the 10-minute
   * retailer-response clock - call this once every OrderItem has been added, as the last step
   * of placing an order (see CheckoutComponent).
   */
  submit(id: number): Observable<Order> {
    // placing the order took stock: listings remembered before this would still show it
    return this.http.post<Order>(`/api/orders/${id}/submit`, {}).pipe(tap(() => this.products.invalidateListings()));
  }

  /** Customer-facing cancellation, ownership-checked against customerProfileId server-side. */
  cancel(id: number, customerProfileId: string, reason?: string): Observable<Order> {
    return this.http
      .post<Order>(`/api/orders/${id}/cancel`, { customerProfileId, reason: reason ?? null })
      .pipe(tap(() => this.products.invalidateListings())); // a cancellation gives the stock back
  }

  /** Retailer-only: accept/reject an order awaiting their response. */
  retailerAccept(id: number): Observable<Order> {
    return this.http.post<Order>(`/api/orders/${id}/retailer-accept`, {});
  }

  retailerReject(id: number, request: RetailerRejectRequest): Observable<Order> {
    return this.http.post<Order>(`/api/orders/${id}/retailer-reject`, request);
  }

  /**
   * GET /api/orders (list-all) has no retailerId/customerId filter and is
   * restricted to SUPER_ADMIN/OPERATIONS_MANAGER in S4's own SecurityConfig -
   * a RETAILER or CUSTOMER calling this is expected to 403. Kept as a real
   * call so the caller can surface that gap accurately rather than assuming.
   */
  listAll(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders');
  }

  /** The customer's own orders - real, server-side order history (see GET /api/orders/mine). */
  mineForCustomer(customerProfileId: string): Observable<Order[]> {
    const params = new HttpParams().set('customerProfileId', customerProfileId);
    return this.http.get<Order[]>('/api/orders/mine', { params });
  }

  /**
   * One page of the customer's own order history, newest first (see GET /api/orders/mine/page) -
   * used by OrderListComponent's lazy-load-on-scroll instead of mineForCustomer's "every order at
   * once" for customers with a long history.
   */
  mineForCustomerPaged(customerProfileId: string, page: number, size = 10): Observable<SpringPage<Order>> {
    const params = new HttpParams().set('customerProfileId', customerProfileId).set('page', page).set('size', size);
    return this.http.get<SpringPage<Order>>('/api/orders/mine/page', { params });
  }

  /** The retailer's own incoming orders. */
  mineForRetailer(retailerId: string): Observable<Order[]> {
    const params = new HttpParams().set('retailerId', retailerId);
    return this.http.get<Order[]>('/api/orders/mine', { params });
  }

  /** Orders currently awaiting a delivery partner - the fleet owner's browse-and-accept list. */
  pendingFleetAssignment(): Observable<Order[]> {
    return this.http.get<Order[]>('/api/orders/pending-fleet-assignment');
  }

  /**
   * Simulated payment (no real gateway) - see PaymentTransactionServiceImpl. A CUSTOMER can
   * now create and capture their own payment transaction for their own order (S6's
   * SecurityConfig was carved out for exactly these two routes).
   */
  createPaymentTransaction(request: PaymentTransactionRequest): Observable<PaymentTransaction> {
    return this.http.post<PaymentTransaction>('/api/payment-transactions', request);
  }

  capturePayment(paymentTransactionId: string): Observable<PaymentTransaction> {
    return this.http.post<PaymentTransaction>(
      `/api/payment-transactions/${paymentTransactionId}/capture`,
      {},
    );
  }

  /** This order's payment transaction(s) - used to resolve a paymentTransactionId for a refund. */
  paymentTransactionsForOrder(orderId: number): Observable<PaymentTransaction[]> {
    return this.http.get<PaymentTransaction[]>(`/api/payment-transactions/by-order/${orderId}`);
  }

  /**
   * There is no working "list my orders" endpoint for a CUSTOMER (GET /api/orders
   * has no customer filter and is staff-only anyway - see docs/api-catalog.md
   * OrderController). We track order ids this browser created and fetch each by
   * id instead. This is a client-side-only, per-browser record, not a real order
   * history - a returning user on another device/browser will not see past orders.
   */
  rememberOrderId(orderId: number): void {
    const ids = this.myOrderIds();
    if (!ids.includes(orderId)) {
      ids.unshift(orderId);
      localStorage.setItem(MY_ORDER_IDS_KEY, JSON.stringify(ids));
    }
  }

  myOrderIds(): number[] {
    try {
      const raw = localStorage.getItem(MY_ORDER_IDS_KEY);
      return raw ? (JSON.parse(raw) as number[]) : [];
    } catch {
      return [];
    }
  }
}
