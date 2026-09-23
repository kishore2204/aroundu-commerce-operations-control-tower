import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-support-staff-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './support-staff-shell.component.html',
  styleUrl: './support-staff-shell.component.css',
})
export class SupportStaffShellComponent {
  readonly sidebarOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();

  readonly navItems = [
    { path: '/support-staff/dashboard', label: 'Dashboard', icon: 'fa-gauge-high' },
    { path: '/support-staff/support', label: 'Ticket Queue', icon: 'fa-headset' },
  ];

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
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
