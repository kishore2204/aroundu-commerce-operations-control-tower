import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { RetailerDashboardComponent } from './dashboard.component';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { OrderService } from '../../../core/services/order.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { CatalogueSummary, InventorySummary } from '../../../core/models/inventory.model';
import { Retailer } from '../../../core/models/retailer.model';
import { Order } from '../../../core/models/order.model';

describe('RetailerDashboardComponent', () => {
  const catalogueSummary: CatalogueSummary = { total: 12, active: 9, draft: 3, outOfStock: 1 };
  const inventorySummary: InventorySummary = { totalProducts: 12, totalStock: 340, lowStock: 2, outOfStock: 1 };
  const retailer: Retailer = {
    retailerId: 'r1',
    userAccountId: 'u1',
    operationsManagerId: null,
    cityId: 'c1',
    zoneId: null,
    longitude: null,
    latitude: null,
    businessName: 'Fresh Mart',
    registrationNumber: null,
    gstNumber: null,
    retailerStatus: 'VERIFIED',
    isOpen: true,
    opensAt: null,
    closesAt: null,
  };

  function setup(overrides: {
    catalogueService?: Partial<CatalogueService>;
    inventoryService?: Partial<InventoryService>;
    orderService?: Partial<OrderService>;
    retailerService?: Partial<RetailerService>;
  } = {}) {
    TestBed.configureTestingModule({
      imports: [RetailerDashboardComponent],
      providers: [
        { provide: CatalogueService, useValue: { summary: () => of(catalogueSummary), ...overrides.catalogueService } },
        { provide: InventoryService, useValue: { summary: () => of(inventorySummary), ...overrides.inventoryService } },
        { provide: OrderService, useValue: { mineForRetailer: () => of([]), ...overrides.orderService } },
        {
          provide: RetailerService,
          useValue: { myRetailer: () => retailer, resolveMine: () => of(retailer), ...overrides.retailerService },
        },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(RetailerDashboardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('should create', () => {
    const fixture = setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads and displays catalogue and inventory stats', () => {
    const fixture = setup();
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.componentInstance.catalogueSummary()).toEqual(catalogueSummary);
    expect(fixture.componentInstance.inventorySummary()).toEqual(inventorySummary);
    const values = fixture.debugElement.queryAll(By.css('.value')).map((el) => el.nativeElement.textContent.trim());
    expect(values).toEqual(['12', '3', '2', '1']);
  });

  it('shows the real order list once resolved', () => {
    const orders: Order[] = [
      {
        id: 1,
        orderNumber: 'ORD-1',
        customerProfileId: 'c1',
        orderType: 'RETAIL',
        orderDate: '2026-01-01T00:00:00Z',
        subtotalAmount: 100,
        deliveryCharge: 10,
        discountAmount: 0,
        totalAmount: 110,
        orderStatus: 'NEW',
        statusHistoryJson: '{}',
        orderTrackingJson: '{}',
        deliveryAddress: null,
        deliveryLatitude: null,
        deliveryLongitude: null,
        paymentMethod: 'CARD',
        paymentStatus: 'PENDING',
        transactionReference: null,
        cancellationReason: null,
        cancelledDatetime: null,
        cancellationFeeAmount: null,
        updatedDatetime: '2026-01-01T00:00:00Z',
      },
    ];
    const fixture = setup({ orderService: { mineForRetailer: () => of(orders) } });
    expect(fixture.componentInstance.recentOrders()).toEqual(orders);
    expect(fixture.debugElement.query(By.css('.order-row'))).not.toBeNull();
  });

  it('shows an empty state when there are no orders', () => {
    const fixture = setup({ orderService: { mineForRetailer: () => throwError(() => new Error('network error')) } });
    expect(fixture.componentInstance.ordersLoading()).toBeFalse();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });
});
