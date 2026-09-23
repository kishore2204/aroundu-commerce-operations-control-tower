import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.css',
})
export class AdminShellComponent {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();

  readonly navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/admin/accounts', label: 'Accounts', icon: 'fa-users' },
    { path: '/admin/operations-managers', label: 'Ops Managers', icon: 'fa-user-tie' },
    { path: '/admin/officers', label: 'Officers', icon: 'fa-user-shield' },
    { path: '/admin/states', label: 'States', icon: 'fa-map' },
    { path: '/admin/territory', label: 'Territory', icon: 'fa-map-location-dot' },
    { path: '/admin/queue', label: 'Verification', icon: 'fa-clipboard-check' },
    { path: '/admin/finance', label: 'Finance', icon: 'fa-sack-dollar' },
    { path: '/admin/support', label: 'Support', icon: 'fa-headset' },
    { path: '/admin/audit', label: 'Audit', icon: 'fa-list-check' },
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
