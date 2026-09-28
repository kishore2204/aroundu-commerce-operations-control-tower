/* Reset password - port of features/auth/reset-password/reset-password.component.* */
(function () {
  const R = InputRules;
  const passwordsMatch = (group) => {
    const a = group.get('newPassword').value;
    const b = group.get('confirmPassword').value;
    return a && b && a !== b ? { mismatch: true } : null;
  };
  window.ResetPasswordPage = {
    tag: 'app-reset-password',
    init() {
      this.state = U.state({ loading: false, errorMessage: null, success: false, showPassword: false, showConfirmPassword: false });
      this.token = U.query('token');
      this.form = U.group({
        newPassword: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
        confirmPassword: U.control('', [V.required], { nonNullable: true }),
      }, [passwordsMatch]);
    },
    submit() {
      const s = this.state;
      if (this.form.invalid || !this.token) return;
      s.loading = true;
      s.errorMessage = null;
      AuthService.resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword }).then(
        () => { s.loading = false; s.success = true; setTimeout(() => Nav.go('/login'), 1500); },
        (err) => { s.loading = false; s.errorMessage = U.extractErrorMessage(err, 'Could not reset your password. The link may have expired.'); },
      );
    },
    render() {
      const html = U.html;
      const s = this.state;
      const f = this.form.controls;
      const eye = (flag, toggle) => html`
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="${toggle}" aria-label="${flag ? 'Hide password' : 'Show password'}">
            <i class="${U.cls('fa-solid', { 'fa-eye': !flag, 'fa-eye-slash': flag })}"></i>
          </button>`;
      return html`
<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-zepto-700 to-zepto-900 p-4">
  <div class="card w-full max-w-md p-8">
    <h1 class="text-center text-2xl font-extrabold text-slate-900">Reset password</h1>
    <p class="mt-1 text-center text-sm text-slate-500">Choose a new password for your account</p>

    ${!this.token ? html`
      <p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
        This link is missing its reset token. Request a new link from the forgot-password page.
      </p>` : s.success ? html`
      <p class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
        Password reset! Redirecting you to sign in&hellip;
      </p>` : html`
      ${s.errorMessage ? html`
        <p class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
          ${s.errorMessage}
        </p>` : ''}

      <form novalidate class="mt-5 space-y-4" onsubmit="event.preventDefault(); Page.submit()">
        <div>
          <label class="form-label req-mark">New password${FieldHint('password')}</label>
          <div class="relative">
            <input class="input !pr-11" type="${s.showPassword ? 'text' : 'password'}" name="newPassword" ${U.bind('Page.form', 'newPassword', f.newPassword)} autocomplete="new-password" />
            ${eye(s.showPassword, 'Page.state.showPassword = !Page.state.showPassword')}
          </div>
          ${PasswordRequirements(f.newPassword.value)}
        </div>
        <div>
          <label class="form-label req-mark">Confirm new password${FieldHint('confirmPassword')}</label>
          <div class="relative">
            <input class="input !pr-11" type="${s.showConfirmPassword ? 'text' : 'password'}" name="confirmPassword" ${U.bind('Page.form', 'confirmPassword', f.confirmPassword)} autocomplete="new-password" />
            ${eye(s.showConfirmPassword, 'Page.state.showConfirmPassword = !Page.state.showConfirmPassword')}
          </div>
          ${this.form.errors && this.form.errors.mismatch && f.confirmPassword.touched ? html`
            <p class="mt-1 text-xs font-semibold text-rose-600">Passwords do not match.</p>` : ''}
        </div>
        <button class="btn-primary w-full" type="submit" ${U.dis(this.form.invalid || s.loading)}>
          ${s.loading ? html`<span class="spinner h-5 w-5 border-2 border-white/40 border-t-white"></span>` : html`Reset password`}
        </button>
      </form>`}

    <p class="mt-5 text-center text-sm text-slate-600">
      <a href="${Nav.href('/login')}" class="font-bold text-zepto-600 hover:text-zepto-700">Back to sign in</a>
    </p>
  </div>
</div>`;
    },
  };
})();
