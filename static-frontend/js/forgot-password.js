/* Forgot password - port of features/auth/forgot-password/forgot-password.component.* */
window.ForgotPasswordPage = {
  tag: 'app-forgot-password',
  init() {
    this.state = U.state({ loading: false, errorMessage: null, result: null });
    this.form = U.group({ email: U.control('', [V.required, V.email], { nonNullable: true }) });
  },
  submit() {
    const s = this.state;
    if (this.form.invalid) return;
    s.loading = true;
    s.errorMessage = null;
    s.result = null;
    AuthService.forgotPassword(this.form.getRawValue().email).then(
      (response) => { s.loading = false; s.result = response; },
      (err) => { s.loading = false; s.errorMessage = U.extractErrorMessage(err, 'Could not process this request.'); },
    );
  },
  render() {
    const html = U.html;
    const s = this.state;
    const result = s.result;
    return html`
<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-zepto-700 to-zepto-900 p-4">
  <div class="card w-full max-w-md p-8">
    <h1 class="text-center text-2xl font-extrabold text-slate-900">Forgot password</h1>
    <p class="mt-1 text-center text-sm text-slate-500">We'll help you get back into your account</p>

    ${s.errorMessage ? html`
      <p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
        ${s.errorMessage}
      </p>` : ''}

    ${result ? html`
      <div class="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <p class="font-semibold">${result.message}</p>
        ${result.resetLink ? html`
          <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <p class="text-xs font-bold uppercase tracking-wide">Development mode — no email is sent</p>
            <p class="mt-1">Use this link to reset your password:</p>
            <a href="${Nav.href(result.resetLink.split('?')[0], { token: result.resetToken })}"
               class="mt-1 block break-all font-mono text-xs font-bold text-zepto-700 underline">
              ${result.resetLink}
            </a>
          </div>` : ''}
      </div>` : html`
      <form novalidate class="mt-5 space-y-4" onsubmit="event.preventDefault(); Page.submit()">
        <div>
          <label class="form-label req-mark">Email</label>
          <input class="input" type="email" name="email" ${U.bind('Page.form', 'email', this.form.controls.email)} autocomplete="email" />
        </div>
        <button class="btn-primary w-full" type="submit" ${U.dis(this.form.invalid || s.loading)}>
          ${s.loading ? html`<span class="spinner h-5 w-5 border-2 border-white/40 border-t-white"></span>` : html`Send reset link`}
        </button>
      </form>`}

    <p class="mt-5 text-center text-sm text-slate-600">
      <a href="${Nav.href('/login')}" class="font-bold text-zepto-600 hover:text-zepto-700">Back to sign in</a>
    </p>
  </div>
</div>`;
  },
};
