import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { retailerProfileGuard } from './core/auth/retailer-profile.guard';
import { fleetOwnerProfileGuard } from './core/auth/fleet-owner-profile.guard';
import { addressRequiredGuard } from './core/auth/address-required.guard';
import { guestLandingGuard } from './core/auth/guest-landing.guard';

export const routes: Routes = [
  {
    // Public marketing landing page. Already-logged-in visitors are bounced to their role's
    // workspace by guestLandingGuard instead of seeing this.
    path: '',
    pathMatch: 'full',
    canActivate: [guestLandingGuard],
    loadComponent: () => import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'unavailable',
    loadComponent: () =>
      import('./features/unavailable/unavailable.component').then((m) => m.UnavailableComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard, roleGuard('CUSTOMER')],
    children: [
      {
        // Not gated by addressRequiredGuard - this IS the gate's own destination.
        path: 'add-address',
        loadComponent: () => import('./features/add-address/add-address.component').then((m) => m.AddAddressComponent),
      },
      {
        path: 'home',
        canActivate: [addressRequiredGuard],
        loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'products',
        canActivate: [addressRequiredGuard],
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then((m) => m.ProductListComponent),
      },
      {
        path: 'products/:id',
        canActivate: [addressRequiredGuard],
        loadComponent: () =>
          import('./features/products/product-detail/product-detail.component').then(
            (m) => m.ProductDetailComponent,
          ),
      },
      {
        path: 'cart',
        canActivate: [addressRequiredGuard],
        loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'wishlist',
        canActivate: [addressRequiredGuard],
        loadComponent: () => import('./features/wishlist/wishlist.component').then((m) => m.WishlistComponent),
      },
      {
        path: 'addresses',
        loadComponent: () =>
          import('./features/addresses/address-list.component').then((m) => m.AddressListComponent),
      },
      {
        path: 'checkout',
        canActivate: [addressRequiredGuard],
        loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
      },
      {
        path: 'orders',
        canActivate: [addressRequiredGuard],
        loadComponent: () =>
          import('./features/orders/order-list/order-list.component').then((m) => m.OrderListComponent),
      },
      {
        path: 'orders/:id',
        canActivate: [addressRequiredGuard],
        loadComponent: () =>
          import('./features/orders/order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'logistics',
        canActivate: [addressRequiredGuard],
        loadComponent: () =>
          import('./features/logistics/logistics-booking.component').then((m) => m.LogisticsBookingComponent),
      },
      {
        path: 'support',
        canActivate: [addressRequiredGuard],
        loadComponent: () => import('./features/support/customer-support/customer-support.component').then((m) => m.CustomerSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        // Sibling of 'profile', not nested under it in the component tree - matches the URL a
        // relative routerLink from the embedded <app-my-tickets> inside ProfileComponent's
        // Support tab resolves to ('profile' is that link's ambient ActivatedRoute).
        path: 'profile/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
    ],
  },
  {
    path: 'retailer',
    loadComponent: () =>
      import('./layout/retailer-shell/retailer-shell.component').then((m) => m.RetailerShellComponent),
    canActivate: [authGuard, roleGuard('RETAILER')],
    children: [
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./features/retailer/onboarding/onboarding.component').then((m) => m.RetailerOnboardingComponent),
      },
      {
        path: 'dashboard',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/dashboard/dashboard.component').then((m) => m.RetailerDashboardComponent),
      },
      {
        path: 'catalogue',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/catalogue/catalogue.component').then((m) => m.RetailerCatalogueComponent),
      },
      {
        path: 'inventory',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/inventory/inventory.component').then((m) => m.RetailerInventoryComponent),
      },
      {
        path: 'orders',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/orders/orders.component').then((m) => m.RetailerOrdersComponent),
      },
      {
        path: 'store',
        canActivate: [retailerProfileGuard],
        loadComponent: () => import('./features/retailer/store/store.component').then((m) => m.RetailerStoreComponent),
      },
      {
        path: 'profile',
        canActivate: [retailerProfileGuard],
        loadComponent: () => import('./features/retailer/profile/profile.component').then((m) => m.RetailerProfileComponent),
      },
      {
        path: 'finance',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/finance/finance.component').then((m) => m.RetailerFinanceComponent),
      },
      {
        path: 'support',
        canActivate: [retailerProfileGuard],
        loadComponent: () => import('./features/support/user-support/user-support.component').then((m) => m.UserSupportComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/retailer/notifications/notifications.component').then((m) => m.RetailerNotificationsComponent),
      },
      {
        path: 'support/:id',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'escalations',
        canActivate: [retailerProfileGuard],
        loadComponent: () =>
          import('./features/retailer/escalations/retailer-escalations.component').then((m) => m.RetailerEscalationsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'location',
    loadComponent: () =>
      import('./layout/location-shell/location-shell.component').then((m) => m.LocationShellComponent),
    canActivate: [authGuard, roleGuard('LOCATION_MANAGER')],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/location/dashboard/dashboard.component').then((m) => m.LocationDashboardComponent),
      },
      {
        // Where a transferred verification request announces itself to its new Location Manager.
        path: 'notifications',
        loadComponent: () =>
          import('./features/retailer/notifications/notifications.component').then((m) => m.RetailerNotificationsComponent),
      },
      {
        path: 'queue',
        loadComponent: () =>
          import('./features/location/queue-list/queue-list.component').then((m) => m.QueueListComponent),
      },
      {
        path: 'queue/:id',
        loadComponent: () =>
          import('./features/location/queue-detail/queue-detail.component').then((m) => m.QueueDetailComponent),
      },
      {
        // Reuses the same staff ticket-queue screen as operations/support and admin/support -
        // Location Manager is one of the three roles a ticket can be escalated to.
        path: 'support',
        loadComponent: () =>
          import('./features/operations/support/support.component').then((m) => m.OperationsSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'operations',
    loadComponent: () =>
      import('./layout/operations-shell/operations-shell.component').then((m) => m.OperationsShellComponent),
    canActivate: [authGuard, roleGuard('OPERATIONS_MANAGER')],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/operations/dashboard/dashboard.component').then((m) => m.OperationsDashboardComponent),
      },
      {
        path: 'queue',
        loadComponent: () =>
          import('./features/location/queue-list/queue-list.component').then((m) => m.QueueListComponent),
      },
      {
        path: 'queue/:id',
        loadComponent: () =>
          import('./features/location/queue-detail/queue-detail.component').then((m) => m.QueueDetailComponent),
      },
      {
        path: 'officers',
        loadComponent: () =>
          import('./features/operations/officers/officers.component').then((m) => m.OfficersComponent),
      },
      {
        path: 'territory',
        loadComponent: () =>
          import('./features/operations/territory/territory.component').then((m) => m.OperationsTerritoryComponent),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/operations/finance/finance.component').then((m) => m.OperationsFinanceComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./features/operations/support/support.component').then((m) => m.OperationsSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/operations/audit/audit.component').then((m) => m.OperationsAuditComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'fleet',
    loadComponent: () => import('./layout/fleet-shell/fleet-shell.component').then((m) => m.FleetShellComponent),
    canActivate: [authGuard, roleGuard('FLEET_MANAGER')],
    children: [
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./features/fleet/onboarding/onboarding.component').then((m) => m.FleetOnboardingComponent),
      },
      {
        path: 'dashboard',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./features/fleet/dashboard/dashboard.component').then((m) => m.FleetDashboardComponent),
      },
      {
        path: 'drivers',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () => import('./features/fleet/drivers/drivers.component').then((m) => m.FleetDriversComponent),
      },
      {
        path: 'vehicles',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./features/fleet/vehicles/vehicles.component').then((m) => m.FleetVehiclesComponent),
      },
      {
        path: 'assignments',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./features/fleet/assignments/assignments.component').then((m) => m.FleetAssignmentsComponent),
      },
      {
        path: 'expenses',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./features/fleet/expenses/expenses.component').then((m) => m.FleetExpensesComponent),
      },
      {
        path: 'trips',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () => import('./features/fleet/trips/trips.component').then((m) => m.FleetTripsComponent),
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/retailer/notifications/notifications.component').then((m) => m.RetailerNotificationsComponent),
      },
      {
        path: 'support',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () => import('./features/support/user-support/user-support.component').then((m) => m.UserSupportComponent),
      },
      {
        path: 'support/:id',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'escalations',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () =>
          import('./features/fleet/escalations/fleet-escalations.component').then((m) => m.FleetEscalationsComponent),
      },
      {
        path: 'profile',
        canActivate: [fleetOwnerProfileGuard],
        loadComponent: () => import('./features/fleet/profile/profile.component').then((m) => m.FleetProfileComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'driver',
    loadComponent: () =>
      import('./layout/driver-shell/driver-shell.component').then((m) => m.DriverShellComponent),
    canActivate: [authGuard, roleGuard('DRIVER')],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/driver/dashboard/driver-dashboard.component').then((m) => m.DriverDashboardComponent),
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/driver/trips/driver-trips.component').then((m) => m.DriverTripsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/driver/profile/profile.component').then((m) => m.DriverProfileComponent),
      },
      {
        path: 'support',
        loadComponent: () => import('./features/support/user-support/user-support.component').then((m) => m.UserSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/admin-shell/admin-shell.component').then((m) => m.AdminShellComponent),
    canActivate: [authGuard, roleGuard('SUPER_ADMIN')],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'accounts',
        loadComponent: () => import('./features/admin/accounts/accounts.component').then((m) => m.AdminAccountsComponent),
      },
      {
        path: 'operations-managers',
        loadComponent: () =>
          import('./features/admin/operations-managers/operations-managers.component').then(
            (m) => m.AdminOperationsManagersComponent,
          ),
      },
      {
        // Reuses OM's officer (Location Manager) management screen - same permissions, same endpoints.
        path: 'officers',
        loadComponent: () => import('./features/operations/officers/officers.component').then((m) => m.OfficersComponent),
      },
      {
        path: 'states',
        loadComponent: () => import('./features/admin/states/states.component').then((m) => m.AdminStatesComponent),
      },
      {
        // Reuses OM's full-CRUD territory screen - SUPER_ADMIN has the same write access.
        path: 'territory',
        loadComponent: () =>
          import('./features/operations/territory/territory.component').then((m) => m.OperationsTerritoryComponent),
      },
      {
        // Reuses the same verification-queue components as /location and /operations.
        path: 'queue',
        loadComponent: () => import('./features/location/queue-list/queue-list.component').then((m) => m.QueueListComponent),
      },
      {
        path: 'queue/:id',
        loadComponent: () =>
          import('./features/location/queue-detail/queue-detail.component').then((m) => m.QueueDetailComponent),
      },
      {
        // Reuses OM's finance (settlements + tax configs) screen - same permissions.
        path: 'finance',
        loadComponent: () =>
          import('./features/operations/finance/finance.component').then((m) => m.OperationsFinanceComponent),
      },
      {
        // Reuses OM's support (tickets + notifications) screen - same permissions.
        path: 'support',
        loadComponent: () =>
          import('./features/operations/support/support.component').then((m) => m.OperationsSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        // Reuses OM's audit-log screen - same permissions.
        path: 'audit',
        loadComponent: () => import('./features/operations/audit/audit.component').then((m) => m.OperationsAuditComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'support-staff',
    loadComponent: () =>
      import('./layout/support-staff-shell/support-staff-shell.component').then((m) => m.SupportStaffShellComponent),
    canActivate: [authGuard, roleGuard('SUPPORT_STAFF')],
    children: [
      {
        // Overview landing page (metrics + tickets needing attention) - the actual ticket
        // queues/notify screen lives at 'support' below, same as every other portal reusing
        // OperationsSupportComponent.
        path: 'dashboard',
        loadComponent: () =>
          import('./features/support/dashboard/support-dashboard.component').then((m) => m.SupportDashboardComponent),
      },
      {
        // Same staff ticket-queue screen as operations/admin/location.
        path: 'support',
        loadComponent: () =>
          import('./features/operations/support/support.component').then((m) => m.OperationsSupportComponent),
      },
      {
        path: 'support/:id',
        loadComponent: () =>
          import('./shared/support/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
