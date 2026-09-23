import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LocationManagerAssignmentService } from '../../core/services/location-manager-assignment.service';

@Component({
  selector: 'app-location-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './location-shell.component.html',
  styleUrl: './location-shell.component.css',
})
export class LocationShellComponent implements OnInit {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly collapsed = signal(localStorage.getItem('aroundu.sidebarCollapsed') === 'true');
  readonly currentYear = new Date().getFullYear();
  /** This Location Manager's own assigned city/zone - shown as a label in the header, not a
   *  separate "Command Center" tab (there is nothing else to browse: creating/editing
   *  territory is an Operations Manager/Super Admin action). */
  readonly myTerritory = signal<string | null>(null);

  readonly navItems = [
    { path: '/location/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/location/queue', label: 'Verification Queue', icon: 'fa-clipboard-check' },
    { path: '/location/notifications', label: 'Notifications', icon: 'fa-bell' },
    { path: '/location/support', label: 'Support', icon: 'fa-headset' },
  ];

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router,
    private readonly locationManagerAssignmentService: LocationManagerAssignmentService,
  ) {}

  ngOnInit(): void {
    this.locationManagerAssignmentService.mine().subscribe({
      next: (mine) => this.myTerritory.set(`${mine.cityName ?? 'Unknown city'} · ${mine.zoneName ?? 'Unknown zone'}`),
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
