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
      this.form = U.group(
        {
          newPassword: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
          confirmPassword: U.control('', [V.required], { nonNullable: true }),
        },
        [passwordsMatch],
      );
    },
    submit() {
      const s = this.state;
      if (this.form.invalid || !this.token) return;
      s.loading = true;
      s.errorMessage = null;
      AuthService.resetPassword({ token: this.token, newPassword: this.form.getRawValue().newPassword }).then(
        () => {
          s.loading = false;
          s.success = true;
          setTimeout(() => Nav.go('/login'), 1500);
        },
        (err) => {
          s.loading = false;
          s.errorMessage = U.extractErrorMessage(err, 'Could not reset your password. The link may have expired.');
        },
      );
    },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const eye = (flag, toggle) =>
        U.tpl('reset-password-eye', [
          toggle,
          flag ? 'Hide password' : 'Show password',
          U.clsMore({ 'fa-eye': !flag, 'fa-eye-slash': flag }),
        ]);
      return U.tpl('reset-password', [
        !this.token
          ? U.tpl('reset-password-1')
          : s.success
            ? U.tpl('reset-password-2')
            : U.tpl('reset-password-3', [
                s.errorMessage ? U.tpl('reset-password-3-1', [s.errorMessage]) : '',
                FieldHint('password'),
                s.showPassword ? 'text' : 'password',
                U.bind('Page.form', 'newPassword', f.newPassword),
                eye(s.showPassword, 'Page.state.showPassword = !Page.state.showPassword'),
                PasswordRequirements(f.newPassword.value),
                FieldHint('confirmPassword'),
                s.showConfirmPassword ? 'text' : 'password',
                U.bind('Page.form', 'confirmPassword', f.confirmPassword),
                eye(s.showConfirmPassword, 'Page.state.showConfirmPassword = !Page.state.showConfirmPassword'),
                this.form.errors && this.form.errors.mismatch && f.confirmPassword.touched ? U.tpl('reset-password-3-2') : '',
                U.dis(this.form.invalid || s.loading),
                s.loading ? U.tpl('reset-password-3-3') : U.tpl('reset-password-3-4'),
              ]),
        Nav.href('/login'),
      ]);
    },
  };
})();
