import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { FleetOwnerService } from '../../core/services/fleet-owner.service';
import { TerritoryService } from '../../core/services/territory.service';

@Component({
  selector: 'app-fleet-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './fleet-shell.component.html',
  styleUrl: './fleet-shell.component.css',
})
export class FleetShellComponent implements OnInit {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  /** Desktop sidebar collapse (icon-only) - distinct from sidebarOpen, which is the mobile
   *  overlay toggle. Persisted per-browser so it survives navigation/reload. */
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();
  /** This Fleet Manager's own city/zone - shown as a small label in the header. */
  readonly myTerritory = signal<string | null>(null);

  readonly navItems = [
    { path: '/fleet/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/fleet/assignments', label: 'Assignments', icon: 'fa-clipboard-list' },
    { path: '/fleet/drivers', label: 'Drivers', icon: 'fa-id-card-clip' },
    { path: '/fleet/expenses', label: 'Expenses', icon: 'fa-money-bill-wave' },
    { path: '/fleet/escalations', label: 'Escalations', icon: 'fa-triangle-exclamation' },
    { path: '/fleet/notifications', label: 'Notifications', icon: 'fa-bell' },
    { path: '/fleet/onboarding', label: 'Onboarding', icon: 'fa-clipboard-check' },
    { path: '/fleet/trips', label: 'Trips', icon: 'fa-route' },
    { path: '/fleet/vehicles', label: 'Vehicles', icon: 'fa-truck' },
    { path: '/fleet/profile', label: 'Profile', icon: 'fa-id-card' },
  ];

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router,
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly territoryService: TerritoryService,
  ) {}

  ngOnInit(): void {
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        if (!owner?.cityId) return;
        this.territoryService.cities().subscribe({
          next: (cityPage) => {
            const cityName = cityPage.content.find((c) => c.id === owner.cityId)?.cityName ?? 'Unknown city';
            if (!owner.zoneId) {
              this.myTerritory.set(cityName);
              return;
            }
            this.territoryService.zones(owner.cityId).subscribe({
              next: (zonePage) => {
                const zoneName = zonePage.content.find((z) => z.zoneId === owner.zoneId)?.zoneName ?? 'Unknown zone';
                this.myTerritory.set(`${cityName} · ${zoneName}`);
              },
              error: () => this.myTerritory.set(cityName),
            });
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

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
