import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { CustomerSupportComponent } from '../support/customer-support/customer-support.component';
import { AddressListComponent } from '../addresses/address-list.component';
import { AuthService } from '../../core/auth/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { NotificationService } from '../../core/services/notification.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { CurrentUser, CustomerProfile } from '../../core/models/user.model';
import { Notification } from '../../core/models/notification.model';
import { forkJoin } from 'rxjs';
import { DigitsOnlyDirective } from '../../shared/input-rules/digits-only.directive';
import { FieldHintComponent } from '../../shared/field-hint/field-hint.component';
import { mobileNumberValidator } from '../../core/validation/input-rules';

type ProfileTab = 'profile' | 'addresses' | 'notifications' | 'support';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DigitsOnlyDirective, FieldHintComponent, DatePipe, ReactiveFormsModule, EmptyStateComponent, CustomerSupportComponent, AddressListComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  readonly activeTab = signal<ProfileTab>('profile');
  readonly loading = signal(true);
  readonly currentUser = signal<CurrentUser | null>(null);
  readonly profile = signal<CustomerProfile | null>(null);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly notifications = signal<Notification[]>([]);
  readonly notificationsLoading = signal(true);

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, mobileNumberValidator()]],
    dateOfBirth: [''],
  });

  constructor(
    private readonly auth: AuthService,
    private readonly customerService: CustomerService,
    private readonly notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.auth.fetchCurrentUser().subscribe({
      next: (user) => {
        this.currentUser.set(user);
        this.form.patchValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, phoneNumber: user.phoneNumber });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.customerService.me().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue({ dateOfBirth: profile.dateOfBirth ?? '' });
      },
      error: () => {},
    });

    this.notificationService.mine().subscribe({
      next: (list) => {
        this.notifications.set(list);
        this.notificationsLoading.set(false);
      },
      error: () => this.notificationsLoading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);
    const { firstName, lastName, email, phoneNumber, dateOfBirth } = this.form.getRawValue();
    forkJoin({
      user: this.auth.updateCurrentUser({ firstName, lastName, email, phoneNumber }),
      profile: this.customerService.update({ dateOfBirth: dateOfBirth || null }),
    }).subscribe({
      next: ({ user, profile }) => {
        this.currentUser.set(user);
        this.profile.set(profile);
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(extractErrorMessage(err, 'Could not save changes.'));
      },
    });
  }
}
