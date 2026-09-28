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
    return U.tpl('login', [
      this.sessionExpired ? U.tpl('login-1') : '',
      s.errorMessage ? U.tpl('login-2', [s.errorMessage]) : '',
      U.bind('Page.form', 'email', f.email),
      Nav.href('/forgot-password'),
      s.showPassword ? 'text' : 'password',
      U.bind('Page.form', 'password', f.password),
      s.showPassword ? 'Hide password' : 'Show password',
      U.clsMore({ 'fa-eye': !s.showPassword, 'fa-eye-slash': s.showPassword }),
      U.dis(s.loading),
      s.loading ? U.tpl('login-3') : U.tpl('login-4'),
      Nav.href('/register'),
      this.currentYear,
    ]);
  },
};
