import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

/**
 * Digits-only text input (mobile number, postal code): `<input [appDigitsOnly]="10" ...>`.
 *
 * Non-digits are rejected while typing (keyboard), removed from pasted / dropped / IME text, and the value is
 * capped at the given number of digits. The cleaned value is written back through a real `input` event, so
 * reactive forms, `ngModel` and the validators all see exactly what is displayed.
 * This is only the typing aid - the form validator and the backend still validate the final value.
 */
@Directive({
  selector: 'input[appDigitsOnly]',
  standalone: true,
  host: { '[attr.inputmode]': '"numeric"', '[attr.maxlength]': 'max() === Infinity ? null : max()', autocomplete: 'off' },
})
export class DigitsOnlyDirective {
  /** Maximum number of digits, e.g. 10 for a mobile number and 6 for a postal code. */
  readonly appDigitsOnly = input<number | string>('');
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  max(): number {
    const limit = Number(this.appDigitsOnly());
    return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return; // Backspace, arrows, Tab, shortcuts...
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      return;
    }
    const noSelection = this.element.selectionStart === this.element.selectionEnd;
    if (noSelection && this.element.value.length >= this.max()) event.preventDefault();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    const start = this.element.selectionStart ?? this.element.value.length;
    const end = this.element.selectionEnd ?? this.element.value.length;
    const merged = (this.element.value.slice(0, start) + digits + this.element.value.slice(end)).slice(0, this.max());
    this.write(merged);
  }

  /** Anything that still reaches the field (drag-and-drop, IME, autofill) is cleaned here. */
  @HostListener('input')
  onInput(): void {
    const clean = this.element.value.replace(/\D/g, '').slice(0, this.max());
    if (clean !== this.element.value) this.write(clean);
  }

  private write(value: string): void {
    this.element.value = value;
    this.element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
