/* Not available for your account yet - port of features/unavailable/unavailable.component.* */
window.UnavailablePage = {
  tag: 'app-unavailable',
  render() {
    return U.html`
<div class="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
  <i class="fa-solid fa-map-location-dot text-6xl text-zepto-300"></i>
  <h1 class="text-xl font-extrabold text-slate-900">Not available for your account yet</h1>
  <p class="max-w-sm text-sm text-slate-500">
    This workspace is currently only built for CUSTOMER accounts. Support for your role is coming in a future update.
  </p>
  <a class="btn-primary mt-2" href="${Nav.href('/login')}">Back to sign in</a>
</div>`;
  },
};
