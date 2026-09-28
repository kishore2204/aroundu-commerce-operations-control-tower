/* Sign in - port of features/auth/login/login.component.* */
window.LoginPage = {
  tag: 'app-login',
  init() {
    this.state = U.state({ loading: false, errorMessage: null, showPassword: false });
    this.sessionExpired = U.query('sessionExpired') === 'true';
    this.currentYear = new Date().getFullYear();
    this.form = U.group({
      email: U.control('', [V.required, V.email], { nonNullable: true }),
      password: U.control('', [V.required], { nonNullable: true }),
    });
  },
  submit() {
    const s = this.state;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Toast.show(this.firstValidationMessage(), 'error');
      return;
    }
    if (s.loading) return;
    s.loading = true;
    s.errorMessage = null;
    const { email, password } = this.form.getRawValue();
    AuthService.login({ email: email.trim(), password }).then(
      (response) => Nav.go(RoleLanding.landingRouteFor(response.role)),
      (err) => {
        s.loading = false;
        s.errorMessage = U.extractErrorMessage(err, 'Could not sign in. Check your email and password.');
      },
    );
  },
  firstValidationMessage() {
    const email = this.form.controls.email;
    if (email.hasError('required')) return 'Please enter your email address.';
    if (email.hasError('email')) return 'Please enter a valid email address.';
    if (this.form.controls.password.hasError('required')) return 'Please enter your password.';
    return 'Please fill in all required fields correctly.';
  },
  render() {
    const s = this.state;
    const f = this.form.controls;
    return U.html`
<div class="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-zepto-700 via-indigo-700 to-violet-900">
 <div class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-white/10 to-violet-400/20 blur-3xl"></div>
 <div class="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-gradient-to-br from-amber-300/15 to-rose-400/15 blur-3xl"></div>
 <div class="relative z-10 flex flex-1 items-center justify-center p-4">
  <div class="card w-full max-w-md p-8">
    <h1 class="text-center text-2xl font-extrabold text-slate-900">Sign in</h1>
    <p class="mt-1 text-center text-sm text-slate-500">Welcome back to AroundU</p>

    ${this.sessionExpired ? U.html`
      <p class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
        Your session expired. Please sign in again.
      </p>` : ''}
    ${s.errorMessage ? U.html`
      <p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
        ${s.errorMessage}
      </p>` : ''}

    <form novalidate class="mt-5 space-y-4" onsubmit="event.preventDefault(); Page.submit()">
      <div>
        <label class="form-label req-mark">Email</label>
        <input class="input" type="email" name="email" ${U.bind('Page.form', 'email', f.email)} autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" />
      </div>
      <div>
        <div class="flex items-center justify-between">
          <label class="form-label req-mark">Password</label>
          <a href="${Nav.href('/forgot-password')}" class="text-xs font-semibold text-zepto-600 hover:text-zepto-700">Forgot password?</a>
        </div>
        <div class="relative">
          <input type="${s.showPassword ? 'text' : 'password'}" class="input !pr-11" name="password" ${U.bind('Page.form', 'password', f.password)} autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="Page.state.showPassword = !Page.state.showPassword" aria-label="${s.showPassword ? 'Hide password' : 'Show password'}">
            <i class="${U.cls('fa-solid', { 'fa-eye': !s.showPassword, 'fa-eye-slash': s.showPassword })}"></i>
          </button>
        </div>
      </div>
      <button class="btn-primary w-full" type="submit" ${U.dis(s.loading)}>
        ${s.loading ? U.html`<span class="spinner h-5 w-5 border-2 border-white/40 border-t-white"></span>` : U.html`Sign in`}
      </button>
    </form>

    <p class="mt-5 text-center text-sm text-slate-600">
      New to AroundU? <a href="${Nav.href('/register')}" class="font-bold text-zepto-600 hover:text-zepto-700">Create an account</a>
    </p>
  </div>
 </div>
 <footer class="border-t border-white/10 px-4 py-5 text-center text-xs font-medium text-white/60">
   &copy; ${this.currentYear} AroundU &middot; Local Logistics &amp; Hyperlocal Retail Platform
 </footer>
</div>`;
  },
};
