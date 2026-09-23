import { Component, EventEmitter, HostListener, Output } from '@angular/core';

/** One titled section of the placeholder terms text rendered by the dialog. */
export interface TermsSection {
  heading: string;
  paragraphs: string[];
}

/**
 * Read-only "Terms and Conditions" modal shown when a user clicks the Terms and Conditions
 * link on the registration form. Follows the same plain-Tailwind modal pattern as
 * ServiceabilityConflictDialogComponent: the host renders it with `@if`/`*ngIf` and it emits
 * `closed` when dismissed via the close button, the backdrop, or Escape.
 *
 * The content below is demo placeholder text for this sample platform - it is not a real
 * legal agreement and should be replaced before any production use.
 */
@Component({
  selector: 'app-terms-dialog',
  standalone: true,
  imports: [],
  templateUrl: './terms-dialog.component.html',
  styleUrl: './terms-dialog.component.css',
})
export class TermsDialogComponent {
  /** Emitted when the dialog is dismissed (close button, backdrop click, or Escape). */
  @Output() readonly closed = new EventEmitter<void>();

  readonly lastUpdated = 'Placeholder text - sample content for demo purposes only.';

  readonly sections: TermsSection[] = [
    {
      heading: '1. Your Account',
      paragraphs: [
        'You must provide accurate details when creating an AroundU account and keep your password confidential. You are responsible for activity that happens under your account.',
        'One person may hold one customer account. We may suspend accounts used for fraud, abuse, or any activity that puts other users, retailers, or delivery partners at risk.',
      ],
    },
    {
      heading: '2. Ordering',
      paragraphs: [
        'Prices, product availability, and delivery slots are shown at the time you place an order and may change afterwards. An order is confirmed only once the retailer accepts it.',
        'If an item turns out to be unavailable or not serviceable at your delivery address, we will tell you and either substitute the item with your agreement or refund that part of the order.',
      ],
    },
    {
      heading: '3. Delivery',
      paragraphs: [
        'Delivery times and fare estimates are indicative. Traffic, weather, and partner availability can change them.',
        'Someone must be available at the delivery address to receive the order. If nobody is reachable after reasonable attempts, the order may be returned and delivery charges may still apply.',
      ],
    },
    {
      heading: '4. Cancellations and Refunds',
      paragraphs: [
        'You may cancel an order free of charge until the retailer begins preparing it. After that, a cancellation fee may apply to cover work already done.',
        'Approved refunds are returned to the original payment method. Cash orders are refunded to your AroundU wallet or bank account as agreed with support.',
      ],
    },
    {
      heading: '5. Liability',
      paragraphs: [
        'The platform connects you with independent retailers and delivery partners. Product quality, packaging, and descriptions are the responsibility of the selling retailer.',
        'To the extent permitted by law, our liability for any order is limited to the amount you paid for that order. Nothing here limits liability that cannot lawfully be limited.',
      ],
    },
    {
      heading: '6. Changes to These Terms',
      paragraphs: [
        'We may update these terms from time to time. Continuing to use the platform after an update means you accept the revised terms.',
      ],
    },
  ];

  /** Dismisses the dialog when the user presses Escape. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss();
  }

  /** Closes the dialog. */
  dismiss(): void {
    this.closed.emit();
  }
}
