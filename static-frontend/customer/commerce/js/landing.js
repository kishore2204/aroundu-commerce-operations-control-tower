/* Public landing page - port of features/landing/landing.component.* (static markup + scroll-reveal) */
window.LandingPage = {
  tag: 'app-landing',
  render() {
    return U.html`
<noscript><style>.reveal { opacity: 1 !important; transform: none !important; }</style></noscript>
<div class="flex min-h-screen flex-col" data-static>
  <!-- Header -->
  <header class="header-glass">
    <div class="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
      <a href="${Nav.href('/')}" class="mr-2 flex items-center gap-2.5 no-underline group">
        <span class="brandmark font-display shadow-glow group-hover:scale-105 transition-transform duration-300">A</span>
        <span class="text-xl font-display font-black tracking-tight text-slate-900">Around<span class="bg-gradient-to-r from-zepto-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">U</span></span>
      </a>

      <nav class="ml-4 hidden md:flex items-center gap-1.5 font-display">
        <a href="#features" class="nav-pill">Features</a>
        <a href="#how-it-works" class="nav-pill">How it Works</a>
        <a href="#for-partners" class="nav-pill">For Partners</a>
      </nav>

      <span class="flex-1"></span>

      <a href="${Nav.href('/login')}" class="btn-outline">Sign in</a>
      <a href="${Nav.href('/register')}" class="btn-primary">Get Started</a>
    </div>
  </header>

  <main class="flex-1">
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-zepto-50">
      <div class="dot-grid pointer-events-none absolute inset-0"></div>
      <div class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-zepto-200/50 to-violet-300/40 blur-3xl drift"></div>
      <div class="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-gradient-to-br from-amber-200/40 to-rose-200/30 blur-3xl drift drift-delay"></div>

      <div class="relative z-10 mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2 lg:py-28">
        <div class="reveal">
          <span class="badge bg-zepto-50 text-zepto-700 border border-zepto-200">
            <i class="fa-solid fa-bolt text-[10px]"></i>
            Hyperlocal Retail &amp; Logistics, in One Platform
          </span>
          <h1 class="mt-5 font-display text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Everything your neighborhood needs, <span class="bg-gradient-to-r from-zepto-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">delivered fast.</span>
          </h1>
          <p class="mt-5 max-w-lg text-base font-medium leading-relaxed text-slate-600 sm:text-lg">
            AroundU connects local stores, delivery fleets and customers on one platform &mdash; order groceries and essentials
            from verified neighborhood retailers, or book instant parcel pickup and delivery across the city.
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            <a href="${Nav.href('/register')}" class="btn-primary px-6 py-3 text-base">
              <span>Get Started Free</span>
              <i class="fa-solid fa-arrow-right text-xs"></i>
            </a>
            <a href="${Nav.href('/login')}" class="btn-outline px-6 py-3 text-base">Sign in</a>
          </div>

          <div class="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-semibold text-slate-500">
            <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-zgreen-500"></i> Verified local retailers</span>
            <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-zgreen-500"></i> Real-time order tracking</span>
            <span class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-zgreen-500"></i> Managed delivery fleet</span>
          </div>
        </div>

        <div class="reveal reveal-delay-1 relative">
          <!-- Decorative floating chips -->
          <span class="float pointer-events-none absolute -right-4 -top-6 z-20 grid h-14 w-14 place-items-center rounded-2xl border border-slate-100 bg-white shadow-xl sm:-right-6">
            <i class="fa-solid fa-bolt text-lg text-amber-500"></i>
          </span>
          <span class="float float-delay pointer-events-none absolute -bottom-5 -left-4 z-20 grid h-12 w-12 place-items-center rounded-full border border-slate-100 bg-white shadow-xl sm:-left-6">
            <i class="fa-solid fa-shield-heart text-base text-emerald-500"></i>
          </span>

          <div class="flex flex-col gap-5">
            <div class="group relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-zepto-700 via-indigo-700 to-violet-800 p-7 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover border border-white/10">
              <div class="pointer-events-none absolute -right-10 -bottom-16 h-56 w-56 rounded-full bg-gradient-to-br from-white/15 to-violet-400/20 blur-xl transition-transform duration-500 group-hover:scale-125"></div>
              <div class="relative z-10 flex items-center justify-between">
                <span class="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <i class="fa-solid fa-store text-xl text-white"></i>
                </span>
                <span class="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">Instant Retail</span>
              </div>
              <div class="relative z-10 mt-6">
                <h2 class="font-display text-xl font-black tracking-tight">Retail Commerce</h2>
                <p class="mt-1.5 text-sm text-white/90 font-medium leading-relaxed">Fresh groceries &amp; essentials from local stores near you</p>
              </div>
            </div>

            <div class="group relative flex min-h-[190px] flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-7 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover border border-white/10">
              <div class="pointer-events-none absolute -right-10 -bottom-16 h-52 w-52 rounded-full bg-gradient-to-br from-white/15 to-amber-300/20 blur-xl transition-transform duration-500 group-hover:scale-125"></div>
              <div class="relative z-10 flex items-center justify-between">
                <span class="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
                  <i class="fa-solid fa-truck-fast text-lg text-white"></i>
                </span>
                <span class="rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">Instant Parcel</span>
              </div>
              <div class="relative z-10 mt-5">
                <h3 class="font-display text-lg font-black tracking-tight">Logistics &amp; Express</h3>
                <p class="mt-1 text-sm text-white/90 font-medium">Book 2-wheelers &amp; mini-trucks for instant pickup</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="mx-auto max-w-[1200px] px-4 py-16 sm:py-24">
      <div class="reveal mx-auto max-w-2xl text-center">
        <h2 class="font-display text-3xl font-black tracking-tight text-slate-900">Built for how your neighborhood moves</h2>
        <p class="mt-3 text-sm font-medium text-slate-500">One account, two services &mdash; shop local stores and send parcels across town.</p>
      </div>

      <div class="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div class="reveal card card-hover">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-zepto-50 border border-zepto-100">
            <i class="fa-solid fa-shop text-lg text-zepto-600"></i>
          </span>
          <h3 class="mt-4 font-display text-base font-bold text-slate-900">Shop Local Stores</h3>
          <p class="mt-1.5 text-sm text-slate-500">Browse and order from verified retailers in your delivery zone.</p>
        </div>
        <div class="reveal reveal-delay-1 card card-hover">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 border border-orange-100">
            <i class="fa-solid fa-truck-fast text-lg text-orange-600"></i>
          </span>
          <h3 class="mt-4 font-display text-base font-bold text-slate-900">Book Parcel Delivery</h3>
          <p class="mt-1.5 text-sm text-slate-500">Send packages by 2-wheeler or mini-truck, picked up in minutes.</p>
        </div>
        <div class="reveal reveal-delay-2 card card-hover">
          <span class="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 border border-violet-100">
            <i class="fa-solid fa-headset text-lg text-violet-600"></i>
          </span>
          <h3 class="mt-4 font-display text-base font-bold text-slate-900">Support When You Need It</h3>
          <p class="mt-1.5 text-sm text-slate-500">Raise a ticket and get help from our support team, fast.</p>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="relative overflow-hidden bg-slate-50/70 border-y border-slate-100">
      <div class="dot-grid pointer-events-none absolute inset-0 opacity-60"></div>
      <div class="relative mx-auto max-w-[1200px] px-4 py-16 sm:py-24">
        <div class="reveal mx-auto max-w-2xl text-center">
          <h2 class="font-display text-3xl font-black tracking-tight text-slate-900">Get started in minutes</h2>
        </div>

        <div class="relative mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          <div class="reveal relative text-center sm:text-left">
            <span class="relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zepto-600 to-violet-500 font-display text-sm font-black text-white shadow-glow sm:mx-0">1</span>
            <!-- Connects to step 2's circle - anchored to this circle's own edge, not a guessed percentage, so it always lines up regardless of column width. -->
            <span class="connector-line pointer-events-none absolute left-10 top-5 hidden h-0.5 w-[calc(100%-1rem)] -translate-y-1/2 sm:block"></span>
            <h3 class="mt-4 font-display text-base font-bold text-slate-900">Create your account</h3>
            <p class="mt-1.5 text-sm text-slate-500">Sign up with your email in under a minute &mdash; no paperwork.</p>
          </div>
          <div class="reveal reveal-delay-1 relative text-center sm:text-left">
            <span class="relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zepto-600 to-violet-500 font-display text-sm font-black text-white shadow-glow sm:mx-0">2</span>
            <span class="connector-line pointer-events-none absolute left-10 top-5 hidden h-0.5 w-[calc(100%-1rem)] -translate-y-1/2 sm:block"></span>
            <h3 class="mt-4 font-display text-base font-bold text-slate-900">Add your address</h3>
            <p class="mt-1.5 text-sm text-slate-500">We match you to local stores and delivery partners in your zone.</p>
          </div>
          <div class="reveal reveal-delay-2 relative text-center sm:text-left">
            <span class="relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-zepto-600 to-violet-500 font-display text-sm font-black text-white shadow-glow sm:mx-0">3</span>
            <h3 class="mt-4 font-display text-base font-bold text-slate-900">Order or book a delivery</h3>
            <p class="mt-1.5 text-sm text-slate-500">Shop from stores nearby, or book a parcel pickup &mdash; then track it live.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- For Partners -->
    <section id="for-partners" class="mx-auto max-w-[1200px] px-4 py-16 sm:py-24">
      <div class="reveal mx-auto max-w-2xl text-center">
        <h2 class="font-display text-3xl font-black tracking-tight text-slate-900">One platform for the whole ecosystem</h2>
        <p class="mt-3 text-sm font-medium text-slate-500">AroundU also powers the businesses and people behind every order.</p>
      </div>

      <div class="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div class="reveal card card-hover text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-zepto-50 border border-zepto-100">
            <i class="fa-solid fa-store text-xl text-zepto-600"></i>
          </span>
          <h3 class="mt-4 font-display text-sm font-bold text-slate-900">Retailers</h3>
          <p class="mt-1.5 text-xs text-slate-500">List your catalogue and manage orders in one dashboard.</p>
        </div>
        <div class="reveal reveal-delay-1 card card-hover text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 border border-orange-100">
            <i class="fa-solid fa-truck-field text-xl text-orange-600"></i>
          </span>
          <h3 class="mt-4 font-display text-sm font-bold text-slate-900">Fleet Owners</h3>
          <p class="mt-1.5 text-xs text-slate-500">Manage vehicles, drivers and trip assignments with ease.</p>
        </div>
        <div class="reveal reveal-delay-2 card card-hover text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 border border-emerald-100">
            <i class="fa-solid fa-motorcycle text-xl text-emerald-600"></i>
          </span>
          <h3 class="mt-4 font-display text-sm font-bold text-slate-900">Drivers</h3>
          <p class="mt-1.5 text-xs text-slate-500">Accept trips, navigate deliveries and earn on your schedule.</p>
        </div>
        <div class="reveal reveal-delay-3 card card-hover text-center">
          <span class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 border border-violet-100">
            <i class="fa-solid fa-sitemap text-xl text-violet-600"></i>
          </span>
          <h3 class="mt-4 font-display text-sm font-bold text-slate-900">Operations Teams</h3>
          <p class="mt-1.5 text-xs text-slate-500">Oversee territory, verification and support at every level.</p>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="mx-auto max-w-[1200px] px-4 pb-20">
      <div class="reveal relative overflow-hidden rounded-3xl bg-gradient-to-br from-zepto-700 via-indigo-700 to-violet-800 px-8 py-16 text-center shadow-xl border border-white/10 sm:px-14 sm:py-20">
        <div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl drift"></div>
        <div class="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl drift drift-delay"></div>
        <h2 class="relative z-10 font-display text-3xl font-black tracking-tight text-white sm:text-4xl">Ready to get started?</h2>
        <p class="relative z-10 mx-auto mt-3 max-w-md text-sm font-medium text-white/85">
          Join AroundU today and get local retail and citywide logistics in one place.
        </p>
        <div class="relative z-10 mt-9 flex flex-wrap items-center justify-center gap-3">
          <a href="${Nav.href('/register')}" class="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-zepto-700 shadow-lg transition-all duration-200 hover:-translate-y-px hover:shadow-2xl active:scale-[0.98]">
            <span>Create your account</span>
            <i class="fa-solid fa-arrow-right text-xs"></i>
          </a>
          <a href="${Nav.href('/login')}" class="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-white/40 px-6 py-3 text-sm font-extrabold text-white transition-all duration-200 hover:bg-white/10">
            Sign in
          </a>
        </div>
      </div>
    </section>
  </main>

  <footer class="border-t border-slate-100 px-4 py-6 text-center text-xs font-medium text-slate-400">
    &copy; ${new Date().getFullYear()} AroundU &middot; Local Logistics &amp; Hyperlocal Retail Platform
  </footer>
</div>
`;
  },
  /* ngAfterViewInit: reveal sections as they scroll into view */
  afterMount() {
    const targets = Array.from(document.querySelectorAll('app-landing .reveal'));
    if (targets.length === 0) return;
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    targets.forEach((target) => observer.observe(target));
    setTimeout(() => targets.forEach((target) => target.classList.add('is-visible')), 2000);
  },
};
