import { Component, Input, computed, signal } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [],
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.css',
})
export class StarRatingComponent {
  private readonly _rating = signal(0);
  @Input() set rating(value: number | null | undefined) {
    this._rating.set(value ?? 0);
  }
  @Input() count: number | null = null;
  @Input() showCount = true;

  readonly ratingValue = computed(() => this._rating());
  protected readonly Math = Math;
}
