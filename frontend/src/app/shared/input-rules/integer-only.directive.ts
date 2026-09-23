import { Directive, HostListener } from '@angular/core';

/**
 * Whole-number `type="number"` inputs (stock, low-stock threshold, quantity, model year): blocks the
 * characters a number input still lets through - `e`, `+`, `-`, `.` and `,` - and refuses pasted text that is
 * not purely digits. Decimal fields (price, weight, latitude ...) simply do not use this directive.
 */
@Directive({ selector: 'input[appIntegerOnly]', standalone: true })
export class IntegerOnlyDirective {
  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (['e', 'E', '+', '-', '.', ','].includes(event.key)) event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!/^[0-9]*$/.test(text.trim())) event.preventDefault();
  }
}
