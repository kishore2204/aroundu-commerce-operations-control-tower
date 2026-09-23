import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { StarRatingComponent } from './star-rating.component';

describe('StarRatingComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [StarRatingComponent] });
    return TestBed.createComponent(StarRatingComponent);
  }

  it('should create', () => {
    const fixture = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('treats a null/undefined rating as 0 and fills no stars', () => {
    const fixture = setup();
    fixture.componentInstance.rating = null;
    fixture.detectChanges();

    expect(fixture.componentInstance.ratingValue()).toBe(0);
    const filled = fixture.debugElement.queryAll(By.css('.star.filled'));
    expect(filled.length).toBe(0);
  });

  it('rounds the rating and fills the corresponding number of stars', () => {
    const fixture = setup();
    fixture.componentInstance.rating = 3.6;
    fixture.detectChanges();

    expect(fixture.componentInstance.ratingValue()).toBe(3.6);
    const filled = fixture.debugElement.queryAll(By.css('.star.filled'));
    expect(filled.length).toBe(4);
  });

  it('shows the count only when showCount is true and count is not null', () => {
    const fixture = setup();
    fixture.componentInstance.rating = 4;
    fixture.componentInstance.count = 12;
    fixture.componentInstance.showCount = false;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.count'))).toBeNull();

    fixture.componentInstance.showCount = true;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.count')).nativeElement.textContent).toContain('12');
  });
});
