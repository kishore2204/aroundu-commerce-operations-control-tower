import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CartService } from '../../core/services/cart.service';
import { NotificationService } from '../../core/services/notification.service';
import { AddressService } from '../../core/services/address.service';
import { CustomerZoneService } from '../../core/services/customer-zone.service';
import { Notification } from '../../core/models/notification.model';
import { Address } from '../../core/models/address.model';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  protected readonly accountMenuOpen = signal(false);
  protected readonly notificationsOpen = signal(false);
  protected readonly notifications = signal<Notification[]>([]);
  protected readonly clearingNotifications = signal(false);
  protected readonly unreadCount = signal(0);

  protected readonly addressMenuOpen = signal(false);
  protected readonly myAddresses = signal<Address[]>([]);
  protected readonly switchingAddress = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  constructor(
    protected readonly auth: AuthService,
    private readonly router: Router,
    protected readonly cartService: CartService,
    private readonly notificationService: NotificationService,
    private readonly addressService: AddressService,
    protected readonly zone: CustomerZoneService,
    private readonly toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.cartService.get().subscribe({ error: () => {} });
    this.loadNotifications();
    if (!this.zone.activeAddress()) {
      this.zone.load().subscribe();
    }
  }

  toggleAddressMenu(): void {
    const opening = !this.addressMenuOpen();
    this.addressMenuOpen.set(opening);
    this.accountMenuOpen.set(false);
    this.notificationsOpen.set(false);
    if (opening) {
      this.addressService.list(0, 20).subscribe({
        next: (page) => this.myAddresses.set(page.items),
        error: () => {},
      });
    }
  }

  selectAddress(address: Address): void {
    if (address.id === this.zone.activeAddress()?.id) {
      this.addressMenuOpen.set(false);
      return;
    }
    if (this.cartService.itemCount() > 0) {
      this.toast.open("You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.", 'Dismiss', { duration: 4500 });
      this.addressMenuOpen.set(false);
      return;
    }
    this.switchingAddress.set(true);
    this.zone.setActive(address).subscribe({
      next: () => {
        this.switchingAddress.set(false);
        this.addressMenuOpen.set(false);
      },
      error: () => this.switchingAddress.set(false),
    });
  }

  addressLabel(): string {
    const address = this.zone.activeAddress();
    if (!address) return 'Add delivery address';
    return `${address.line1}, ${address.zoneName ?? address.cityName}`;
  }

  private loadNotifications(): void {
    // only the newest few unread notifications and the unread total - the full history lives on the profile page
    this.notificationService.popup().subscribe({
      next: (popup) => {
        this.notifications.set(popup.items);
        this.unreadCount.set(popup.unreadCount);
      },
      error: () => {},
    });
  }

  /** Empties the popup: the caller's unread notifications are marked read on the server (not deleted). */
  clearNotifications(): void {
    if (this.clearingNotifications() || this.unreadCount() === 0) return;
    this.clearingNotifications.set(true);
    this.notificationService.clearMine().subscribe({
      next: () => {
        this.clearingNotifications.set(false);
        this.notifications.set([]);
        this.unreadCount.set(0);
      },
      error: () => this.clearingNotifications.set(false),
    });
  }

  toggleNotifications(): void {
    this.notificationsOpen.set(!this.notificationsOpen());
    this.accountMenuOpen.set(false);
    this.addressMenuOpen.set(false);
  }

  closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  /** The popup lists unread notifications only, so a clicked one leaves it (and the badge drops by one). */
  markRead(notification: Notification): void {
    if (notification.read) return;
    this.notificationService.markRead(notification.notificationId).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => n.notificationId !== notification.notificationId));
        this.unreadCount.update((count) => Math.max(0, count - 1));
      },
      error: () => {},
    });
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.set(!this.accountMenuOpen());
    this.notificationsOpen.set(false);
    this.addressMenuOpen.set(false);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
    this.notificationsOpen.set(false);
    this.addressMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeAccountMenu();
  }

  logout(): void {
    this.closeAccountMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
