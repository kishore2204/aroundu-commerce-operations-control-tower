/* Create your account - port of features/auth/register/register.component.* */
(function () {
  const R = InputRules;
  const EMAIL_DUPLICATE_MESSAGE = 'An account already exists with this email address.';
  const passwordsMatchValidator = (group) =>
    group.get('password').value === group.get('confirmPassword').value ? null : { passwordMismatch: true };

  window.RegisterPage = {
    tag: 'app-register',
    init() {
      this.state = U.state({
        loading: false,
        errorMessage: null,
        success: false,
        termsOpen: false,
        showPassword: false,
        showConfirmPassword: false,
      });
      this.currentYear = new Date().getFullYear();
      this.form = U.group(
        {
          firstName: U.control('', [R.requiredTrimmed(), V.maxLength(100)], { nonNullable: true }),
          lastName: U.control('', [R.requiredTrimmed(), V.maxLength(100)], { nonNullable: true }),
          email: U.control('', [R.requiredTrimmed(), R.emailValidator(), V.maxLength(R.EMAIL_MAX_LENGTH)], { nonNullable: true }),
          phoneNumber: U.control('', [R.requiredTrimmed(), R.mobileNumberValidator()], { nonNullable: true }),
          password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
          confirmPassword: U.control('', [V.required], { nonNullable: true }),
          role: U.control('CUSTOMER', [V.required], { nonNullable: true }),
          agreeTerms: U.control(false, [V.requiredTrue], { nonNullable: true }),
        },
        [passwordsMatchValidator],
      );
      U.onEscape(() => {});
    },
    selectRole(role) {
      this.form.patchValue({ role });
    },
    submit() {
      const s = this.state;
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        Toast.show(this.firstValidationMessage(), 'error');
        return;
      }
      s.loading = true;
      s.errorMessage = null;
      const { agreeTerms, confirmPassword, ...rest } = this.form.getRawValue();
      const request = Object.assign({}, rest, {
        firstName: rest.firstName.trim(),
        lastName: rest.lastName.trim(),
        email: R.normalizeEmail(rest.email),
        termsAccepted: agreeTerms,
      });
      AuthService.register(request).then(
        () => {
          s.loading = false;
          s.success = true;
          setTimeout(() => Nav.go('/login'), 1200);
        },
        (err) => {
          s.loading = false;
          const message = U.extractErrorMessage(err, 'Could not create your account. Please check your details.');
          s.errorMessage = message;
          if (message === EMAIL_DUPLICATE_MESSAGE) {
            this.form.controls.email.setErrors({ duplicate: true });
            this.form.controls.email.markAsTouched();
          }
        },
      );
    },
    fieldError(name) {
      const control = this.form.controls[name];
      if (!(control.touched || control.dirty)) return null;
      switch (name) {
        case 'firstName':
          return control.hasError('required')
            ? 'First name is required.'
            : control.hasError('maxlength')
              ? 'First name must not exceed 100 characters.'
              : null;
        case 'lastName':
          return control.hasError('required')
            ? 'Last name is required.'
            : control.hasError('maxlength')
              ? 'Last name must not exceed 100 characters.'
              : null;
        case 'email':
          if (control.hasError('required')) return R.EMAIL_REQUIRED_MESSAGE;
          if (control.hasError('email')) return R.EMAIL_MESSAGE;
          if (control.hasError('maxlength')) return R.EMAIL_TOO_LONG_MESSAGE;
          return control.hasError('duplicate') ? EMAIL_DUPLICATE_MESSAGE : null;
        case 'phoneNumber':
          if (control.hasError('required')) return 'Mobile number is required.';
          return control.hasError('mobileNumber') ? `${R.MOBILE_NUMBER_MESSAGE}.` : null;
        case 'password':
          if (control.hasError('required')) return 'Password is required.';
          return control.hasError('passwordPolicy') ? 'Password must meet all the requirements listed below.' : null;
        case 'confirmPassword':
          return control.hasError('required') ? 'Confirm your password.' : null;
        case 'agreeTerms':
          return control.hasError('required') ? 'Accept the Terms and Conditions to continue.' : null;
      }
      return null;
    },
    firstValidationMessage() {
      for (const name of ['firstName', 'lastName', 'email', 'phoneNumber', 'password', 'confirmPassword', 'agreeTerms']) {
        const message = this.fieldError(name);
        if (message) return message;
      }
      if (this.form.hasError('passwordMismatch')) return 'Passwords do not match.';
      return 'Please fill in all required fields correctly.';
    },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const role = this.form.value.role;
      const err = (name) => {
        const m = this.fieldError(name);
        return m ? U.tpl('register-err', [m]) : '';
      };
      const roleButton = (value, icon, label) =>
        U.tpl('register-role-button', [
          U.clsMore({ 'border-zepto-600': role === value, 'bg-zepto-50': role === value, 'border-slate-200': role !== value }),
          value,
          icon,
          label,
        ]);
      const confirmMessage = this.fieldError('confirmPassword');
      return U.tpl('register', [
        s.errorMessage ? U.tpl('register-1', [s.errorMessage]) : '',
        s.success ? U.tpl('register-2') : '',
        U.bind('Page.form', 'firstName', f.firstName),
        err('firstName'),
        U.bind('Page.form', 'lastName', f.lastName),
        err('lastName'),
        FieldHint('email'),
        U.bind('Page.form', 'email', f.email),
        err('email'),
        FieldHint('mobile'),
        U.bind('Page.form', 'phoneNumber', f.phoneNumber),
        err('phoneNumber'),
        roleButton('CUSTOMER', 'fa-bag-shopping', 'Customer'),
        roleButton('RETAILER', 'fa-store', 'Retailer'),
        roleButton('FLEET_MANAGER', 'fa-truck-ramp-box', 'Fleet Owner'),
        FieldHint('password'),
        s.showPassword ? 'text' : 'password',
        U.bind('Page.form', 'password', f.password),
        s.showPassword ? 'Hide password' : 'Show password',
        U.clsMore({ 'fa-eye': !s.showPassword, 'fa-eye-slash': s.showPassword }),
        err('password'),
        PasswordRequirements(f.password.value),
        FieldHint('confirmPassword'),
        s.showConfirmPassword ? 'text' : 'password',
        U.bind('Page.form', 'confirmPassword', f.confirmPassword),
        s.showConfirmPassword ? 'Hide password' : 'Show password',
        U.clsMore({ 'fa-eye': !s.showConfirmPassword, 'fa-eye-slash': s.showConfirmPassword }),
        confirmMessage
          ? U.tpl('register-3', [confirmMessage])
          : (f.confirmPassword.touched || f.confirmPassword.dirty) && this.form.hasError('passwordMismatch')
            ? U.tpl('register-4')
            : '',
        U.bind('Page.form', 'agreeTerms', f.agreeTerms),
        this.fieldError('agreeTerms') ? U.tpl('register-5', [this.fieldError('agreeTerms')]) : '',
        U.dis(s.loading),
        !s.loading ? U.tpl('register-6') : '',
        s.loading ? U.tpl('register-7') : '',
        Nav.href('/login'),
        this.currentYear,
        s.termsOpen ? U.tpl('register-8') : '',
      ]);
    },
  };
})();
