import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-retailer-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './retailer-shell.component.html',
  styleUrl: './retailer-shell.component.css',
})
export class RetailerShellComponent {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();

  readonly navItems = [
    { path: '/retailer/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/retailer/catalogue', label: 'Catalogue', icon: 'fa-book-open' },
    { path: '/retailer/inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
    { path: '/retailer/orders', label: 'Orders', icon: 'fa-receipt' },
    { path: '/retailer/finance', label: 'Finance', icon: 'fa-sack-dollar' },
    { path: '/retailer/escalations', label: 'Escalations', icon: 'fa-triangle-exclamation' },
    { path: '/retailer/notifications', label: 'Notifications', icon: 'fa-bell' },
    { path: '/retailer/support', label: 'Support', icon: 'fa-headset' },
    { path: '/retailer/store', label: 'Store', icon: 'fa-store' },
    { path: '/retailer/profile', label: 'Profile', icon: 'fa-id-card' },
    { path: '/retailer/onboarding', label: 'Onboarding', icon: 'fa-clipboard-check' },
  ];

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    localStorage.setItem('aroundu.sidebarCollapsed', String(next));
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.set(!this.accountMenuOpen());
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
