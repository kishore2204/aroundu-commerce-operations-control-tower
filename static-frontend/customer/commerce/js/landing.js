/* Public landing page - port of features/landing/landing.component.* (static markup + scroll-reveal) */
window.LandingPage = {
  tag: 'app-landing',
  render() {
    return U.tpl('landing', [
      Nav.href('/'),
      Nav.href('/login'),
      Nav.href('/register'),
      Nav.href('/register'),
      Nav.href('/login'),
      Nav.href('/register'),
      Nav.href('/login'),
      new Date().getFullYear(),
    ]);
  },
  /* ngAfterViewInit: reveal sections as they scroll into view */
  afterMount() {
    const targets = Array.from(document.querySelectorAll('app-landing .reveal'));
    if (targets.length === 0) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    targets.forEach((target) => observer.observe(target));
    setTimeout(() => targets.forEach((target) => target.classList.add('is-visible')), 2000);
  },
};
