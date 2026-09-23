import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Rebuilt to match the same sidebar+header shell pattern every other portal uses
 *  (fleet-shell/retailer-shell/etc.) - previously this was a bare top-nav bar with a
 *  narrower max-w-3xl content column, which is why the driver portal looked structurally
 *  different (logo placement, page width) from every other role's portal. */
@Component({
  selector: 'app-driver-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './driver-shell.component.html',
  styleUrl: './driver-shell.component.css',
})
export class DriverShellComponent {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();

  readonly navItems = [
    { path: '/driver/dashboard', label: 'Active Delivery', icon: 'fa-motorcycle' },
    { path: '/driver/trips', label: 'Earnings & Trips', icon: 'fa-wallet' },
    { path: '/driver/support', label: 'Support', icon: 'fa-headset' },
    { path: '/driver/profile', label: 'Profile', icon: 'fa-id-card' },
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
