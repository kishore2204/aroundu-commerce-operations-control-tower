import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-operations-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './operations-shell.component.html',
  styleUrl: './operations-shell.component.css',
})
export class OperationsShellComponent {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();

  readonly navItems = [
    { path: '/operations/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/operations/queue', label: 'Verification', icon: 'fa-clipboard-check' },
    { path: '/operations/officers', label: 'Officers', icon: 'fa-id-card-clip' },
    { path: '/operations/territory', label: 'Territory', icon: 'fa-map-location-dot' },
    { path: '/operations/finance', label: 'Finance', icon: 'fa-sack-dollar' },
    { path: '/operations/support', label: 'Support', icon: 'fa-headset' },
    { path: '/operations/audit', label: 'Audit', icon: 'fa-clipboard-list' },
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
