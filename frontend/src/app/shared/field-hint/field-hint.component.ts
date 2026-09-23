import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { FIELD_HINTS, FieldHintKey } from '../../core/validation/field-hints';

let nextId = 0;

/**
 * The small (i) icon next to an important input: `<app-field-hint field="gstin" />`. Hovering it - or focusing it with the
 * keyboard (Tab) - shows what a correct value looks like, before the user submits. The text comes from FIELD_HINTS, the same
 * place the rules are documented; the field keeps its own error message, this is guidance only.
 *
 * Accessible: a real button with the name "Show GST number requirements", the tooltip has role="tooltip" and is linked with
 * aria-describedby, Escape closes it (it also opens on click/tap for touch screens), and it can be hovered without vanishing.
 * The tooltip is kept inside the viewport and flips above the icon when there is no room below.
 */
@Component({
  selector: 'app-field-hint',
  standalone: true,
  template: `
    <span class="relative inline-block align-middle" (mouseenter)="show()" (mouseleave)="hide()" (keydown.escape)="hide()">
      <button
        #trigger
        type="button"
        class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-slate-400 transition-colors hover:text-violet-600 focus-visible:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="tooltipId"
        [attr.aria-expanded]="open()"
        (focus)="show()"
        (blur)="hide()"
        (click)="onClick($event)"
      >
        <i class="fa-solid fa-circle-info text-[0.8rem]" aria-hidden="true"></i>
      </button>
      <!-- the padding (not a margin) between icon and box keeps the pointer inside the hover area while moving onto the text -->
      <span
        #tooltip
        role="tooltip"
        [id]="tooltipId"
        class="absolute z-50 w-64 max-w-[calc(100vw-1rem)] px-0 text-left"
        [class.hidden]="!open()"
        [class.opacity-0]="!placed()"
        [class.top-full]="!above()"
        [class.pt-1.5]="!above()"
        [class.bottom-full]="above()"
        [class.pb-1.5]="above()"
        [style.left.px]="shift()"
      >
        <span class="block whitespace-pre-line rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg">{{ hint().text }}</span>
      </span>
    </span>
  `,
})
export class FieldHintComponent {
  /** Which requirement text to show - a key of FIELD_HINTS. */
  readonly field = input.required<FieldHintKey>();

  readonly tooltipId = `field-hint-${++nextId}`;
  readonly open = signal(false);
  readonly above = signal(false);
  readonly shift = signal(0);
  /** False for the first frame after opening, until the box has been measured and positioned (avoids a visible jump). */
  readonly placed = signal(false);

  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly tooltip = viewChild.required<ElementRef<HTMLElement>>('tooltip');

  readonly hint = computed(() => FIELD_HINTS[this.field()]);
  readonly ariaLabel = computed(() => `Show ${this.hint().label} requirements`);

  show(): void {
    if (this.open()) return;
    this.open.set(true);
    // measured once the box has actually been rendered (it is display:none until now): keep it on screen (left/right) and
    // flip it above the icon when it would run off the bottom
    afterNextRender(() => this.place(), { injector: this.injector });
  }

  hide(): void {
    this.open.set(false);
    this.placed.set(false);
  }

  /** Tap / click shows it (the focus that comes with it may already have); blur, Escape or leaving with the mouse closes it. */
  onClick(event: Event): void {
    event.preventDefault(); // the icon may sit inside a <label>
    this.show();
  }

  private place(): void {
    if (!this.open()) return;
    const button = this.trigger().nativeElement.getBoundingClientRect();
    const box = this.tooltip().nativeElement;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    const margin = 8;
    const centred = button.left + button.width / 2 - width / 2;
    const clamped = Math.max(margin, Math.min(centred, window.innerWidth - width - margin));
    this.shift.set(Math.round(clamped - button.left));
    this.above.set(button.bottom + height + margin > window.innerHeight && button.top - height - margin > 0);
    this.placed.set(true);
  }
}
