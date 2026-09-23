import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';
import {
  formatVehicleNumber,
  normalizeRegistration,
  sanitizeGstinInput,
  sanitizeLicenceInput,
} from '../../core/validation/input-rules';

/** Which identifier the field takes - decides how what is typed is tidied up. */
export type InputFormat = 'vehicle' | 'gstin' | 'registration' | 'licence';

/**
 * Typing aid for identifier fields: `<input [appFormatInput]="'vehicle'" ...>`.
 *
 *  - vehicle       upper-case, hyphens added as you type (TN01AB1234 -> TN-01-AB-1234, 22BH1234A -> 22-BH-1234-A), and
 *                  stops accepting normalized characters once the detected format's maximum length is reached
 *  - gstin         upper-case, only letters/digits kept, capped at 15 characters
 *  - registration  upper-case, spaces removed (a shop registration number keeps its / and -)
 *  - licence       upper-case, first 2 characters letters-only then digits-only, capped at 16 characters
 *
 * Typing, pasting, autofill and deleting all go through the `input` event. The tidied value is written back through a real
 * `input` event (like DigitsOnlyDirective), so reactive forms, `ngModel` and the validators see exactly what is displayed, and
 * the caret is put back after the same number of real characters - so typing in the middle or backspacing over a hyphen
 * behaves normally instead of jumping to the end. Because the sanitizing/capping happens on every `input` event (typing,
 * paste, and autofill all fire one), an over-length or mis-placed character can never sit in the field, even for a moment -
 * this is still only what is DISPLAYED and typed, though: the validators and the server work on the normalised value and
 * remain the authority on whether the result is actually valid.
 */
@Directive({
  selector: 'input[appFormatInput]',
  standalone: true,
  host: { autocapitalize: 'characters', spellcheck: 'false', autocomplete: 'off' },
})
export class FormattedInputDirective {
  readonly appFormatInput = input.required<InputFormat>();
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

  @HostListener('input')
  onInput(): void {
    const raw = this.element.value;
    const formatted = this.format(raw);
    if (formatted === raw) return;

    const caret = this.element.selectionStart ?? raw.length;
    const realCharsBeforeCaret = this.countReal(raw.slice(0, caret));
    this.element.value = formatted;
    this.element.dispatchEvent(new Event('input', { bubbles: true }));
    if (document.activeElement === this.element) {
      const position = this.positionAfter(formatted, realCharsBeforeCaret);
      this.element.setSelectionRange(position, position);
    }
  }

  private format(value: string): string {
    switch (this.appFormatInput()) {
      case 'vehicle':
        return formatVehicleNumber(value);
      case 'gstin':
        return sanitizeGstinInput(value);
      case 'registration':
        return normalizeRegistration(value);
      case 'licence':
        return sanitizeLicenceInput(value);
    }
  }

  /**
   * A "real" character is one the formatting keeps: the hyphens the vehicle format adds and spaces it removes are not,
   * and for gstin/licence anything outside the character set they keep (a dropped symbol, or a character sanitized away
   * for being in the wrong position or past the maximum length) is not either.
   */
  private isReal(char: string): boolean {
    switch (this.appFormatInput()) {
      case 'vehicle':
        return !/[\s-]/.test(char);
      case 'gstin':
        return /[0-9a-zA-Z]/.test(char);
      case 'registration':
        return !/\s/.test(char);
      case 'licence':
        return /[A-Za-z0-9]/.test(char);
    }
  }

  private countReal(text: string): number {
    let count = 0;
    for (const char of text) if (this.isReal(char)) count++;
    return count;
  }

  /** Caret index in `formatted` just after its n-th real character. */
  private positionAfter(formatted: string, realChars: number): number {
    if (realChars <= 0) return 0;
    let seen = 0;
    for (let index = 0; index < formatted.length; index++) {
      if (this.isReal(formatted[index]) && ++seen === realChars) return index + 1;
    }
    return formatted.length;
  }
}
