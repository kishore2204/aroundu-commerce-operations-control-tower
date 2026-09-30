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
      (response) => {
        s.loading = false;
        s.result = response;
      },
      (err) => {
        s.loading = false;
        s.errorMessage = U.extractErrorMessage(err, 'Could not process this request.');
      },
    );
  },
  render() {
    const s = this.state;
    const result = s.result;
    return U.tpl('forgot-password', [
      s.errorMessage ? U.tpl('forgot-password-1', [s.errorMessage]) : '',
      result
        ? U.tpl('forgot-password-2', [
            result.message,
            result.resetLink
              ? U.tpl('forgot-password-2-1', [Nav.href(result.resetLink.split('?')[0], { token: result.resetToken }), result.resetLink])
              : '',
          ])
        : U.tpl('forgot-password-3', [
            U.bind('Page.form', 'email', this.form.controls.email),
            U.dis(this.form.invalid || s.loading),
            s.loading ? U.tpl('forgot-password-3-1') : U.tpl('forgot-password-3-2'),
          ]),
      Nav.href('/login'),
    ]);
  },
};
