import { AfterViewInit, Component, ElementRef, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  readonly currentYear = new Date().getFullYear();

  private revealObserver?: IntersectionObserver;
  private revealFallbackTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const targets = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.reveal'));
    if (targets.length === 0) {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    targets.forEach((target) => this.revealObserver?.observe(target));

    // Safety net: a throttled/backgrounded tab (or any observer hiccup) must never leave real
    // content permanently invisible - force it in after a short delay regardless.
    this.revealFallbackTimer = setTimeout(() => {
      targets.forEach((target) => target.classList.add('is-visible'));
    }, 2000);
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    clearTimeout(this.revealFallbackTimer);
  }
}
