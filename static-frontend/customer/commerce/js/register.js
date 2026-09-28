/* Create your account - port of features/auth/register/register.component.* */
(function () {
  const R = InputRules;
  const EMAIL_DUPLICATE_MESSAGE = 'An account already exists with this email address.';
  const passwordsMatchValidator = (group) => (group.get('password').value === group.get('confirmPassword').value ? null : { passwordMismatch: true });

  window.RegisterPage = {
    tag: 'app-register',
    init() {
      this.state = U.state({ loading: false, errorMessage: null, success: false, termsOpen: false, showPassword: false, showConfirmPassword: false });
      this.currentYear = new Date().getFullYear();
      this.form = U.group({
        firstName: U.control('', [R.requiredTrimmed(), V.maxLength(100)], { nonNullable: true }),
        lastName: U.control('', [R.requiredTrimmed(), V.maxLength(100)], { nonNullable: true }),
        email: U.control('', [R.requiredTrimmed(), R.emailValidator(), V.maxLength(R.EMAIL_MAX_LENGTH)], { nonNullable: true }),
        phoneNumber: U.control('', [R.requiredTrimmed(), R.mobileNumberValidator()], { nonNullable: true }),
        password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
        confirmPassword: U.control('', [V.required], { nonNullable: true }),
        role: U.control('CUSTOMER', [V.required], { nonNullable: true }),
        agreeTerms: U.control(false, [V.requiredTrue], { nonNullable: true }),
      }, [passwordsMatchValidator]);
      U.onEscape(() => {});
    },
    selectRole(role) { this.form.patchValue({ role }); },
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
      const request = Object.assign({}, rest, { firstName: rest.firstName.trim(), lastName: rest.lastName.trim(), email: R.normalizeEmail(rest.email), termsAccepted: agreeTerms });
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
          return control.hasError('required') ? 'First name is required.' : control.hasError('maxlength') ? 'First name must not exceed 100 characters.' : null;
        case 'lastName':
          return control.hasError('required') ? 'Last name is required.' : control.hasError('maxlength') ? 'Last name must not exceed 100 characters.' : null;
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
      const html = U.html;
      const s = this.state;
      const f = this.form.controls;
      const role = this.form.value.role;
      const err = (name) => { const m = this.fieldError(name); return m ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${m}</p>` : ''; };
      const roleButton = (value, icon, label) => html`
          <button type="button" class="${U.cls('rounded-xl border-2 p-3 text-center transition-colors', { 'border-zepto-600': role === value, 'bg-zepto-50': role === value, 'border-slate-200': role !== value })}" onclick="Page.selectRole('${value}')">
            <i class="fa-solid ${icon} block text-xl text-zepto-600"></i>
            <span class="mt-1 block text-xs font-bold text-slate-800">${label}</span>
          </button>`;
      const confirmMessage = this.fieldError('confirmPassword');
      return html`
<div class="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-zepto-700 via-indigo-700 to-violet-900">
 <div class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-white/10 to-violet-400/20 blur-3xl"></div>
 <div class="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-gradient-to-br from-amber-300/15 to-rose-400/15 blur-3xl"></div>
 <div class="relative z-10 flex flex-1 items-center justify-center p-4">
  <div class="card w-full max-w-md p-8">
    <h1 class="text-center text-2xl font-extrabold text-slate-900">Create your account</h1>
    <p class="mt-1 text-center text-sm text-slate-500">Join AroundU for hyperlocal commerce &amp; logistics</p>

    <form novalidate class="mt-5 space-y-4" onsubmit="event.preventDefault(); Page.submit()">
      ${s.errorMessage ? html`<div class="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">
        <i class="fa-solid fa-triangle-exclamation"></i> ${s.errorMessage}
      </div>` : ''}
      ${s.success ? html`<div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
        <i class="fa-solid fa-circle-check"></i> Account created successfully! Redirecting to sign in...
      </div>` : ''}

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="form-label req-mark">First Name</label>
          <input type="text" class="input" name="firstName" ${U.bind('Page.form', 'firstName', f.firstName)} placeholder="Enter first name" />
          ${err('firstName')}
        </div>
        <div>
          <label class="form-label req-mark">Last Name</label>
          <input type="text" class="input" name="lastName" ${U.bind('Page.form', 'lastName', f.lastName)} placeholder="Enter last name" />
          ${err('lastName')}
        </div>
        <div>
          <label class="form-label req-mark">Email Address${FieldHint('email')}</label>
          <input type="email" class="input" name="email" ${U.bind('Page.form', 'email', f.email)} placeholder="name@domain.com" autocomplete="email" />
          ${err('email')}
        </div>
        <div>
          <label class="form-label req-mark">Mobile Number${FieldHint('mobile')}</label>
          <input type="tel" class="input" name="phoneNumber" ${U.bind('Page.form', 'phoneNumber', f.phoneNumber)} data-digits-only="10" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="10-digit mobile" />
          ${err('phoneNumber')}
        </div>
      </div>

      <div>
        <label class="form-label req-mark">Account Role</label>
        <div class="grid grid-cols-3 gap-2">
          ${roleButton('CUSTOMER', 'fa-bag-shopping', 'Customer')}
          ${roleButton('RETAILER', 'fa-store', 'Retailer')}
          ${roleButton('FLEET_MANAGER', 'fa-truck-ramp-box', 'Fleet Owner')}
        </div>
      </div>

      <div>
        <label class="form-label req-mark">Password${FieldHint('password')}</label>
        <div class="relative">
          <input type="${s.showPassword ? 'text' : 'password'}" class="input !pr-11" name="password" ${U.bind('Page.form', 'password', f.password)} placeholder="Create password" autocomplete="new-password" />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="Page.state.showPassword = !Page.state.showPassword" aria-label="${s.showPassword ? 'Hide password' : 'Show password'}">
            <i class="${U.cls('fa-solid', { 'fa-eye': !s.showPassword, 'fa-eye-slash': s.showPassword })}"></i>
          </button>
        </div>
        ${err('password')}
        ${PasswordRequirements(f.password.value)}
      </div>

      <div>
        <label class="form-label req-mark">Re-enter Password${FieldHint('confirmPassword')}</label>
        <div class="relative">
          <input type="${s.showConfirmPassword ? 'text' : 'password'}" class="input !pr-11" name="confirmPassword" ${U.bind('Page.form', 'confirmPassword', f.confirmPassword)} placeholder="Confirm your password" autocomplete="new-password" />
          <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="Page.state.showConfirmPassword = !Page.state.showConfirmPassword" aria-label="${s.showConfirmPassword ? 'Hide password' : 'Show password'}">
            <i class="${U.cls('fa-solid', { 'fa-eye': !s.showConfirmPassword, 'fa-eye-slash': s.showConfirmPassword })}"></i>
          </button>
        </div>
        ${confirmMessage ? html`
          <p class="mt-1 text-xs font-semibold text-rose-600">${confirmMessage}</p>`
          : (f.confirmPassword.touched || f.confirmPassword.dirty) && this.form.hasError('passwordMismatch') ? html`
          <p class="mt-1 text-xs font-semibold text-rose-600">Passwords do not match.</p>` : ''}
      </div>

      <label class="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
        <input type="checkbox" name="agreeTerms" ${U.bind('Page.form', 'agreeTerms', f.agreeTerms)} class="mt-0.5 h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
        <span class="req-mark">I agree to the <button type="button" class="font-semibold text-zepto-600 hover:text-zepto-700 underline" onclick="Page.state.termsOpen = true">Terms and Conditions</button></span>
      </label>
      ${this.fieldError('agreeTerms') ? html`<p class="-mt-2 text-xs font-semibold text-rose-600">${this.fieldError('agreeTerms')}</p>` : ''}

      <button type="submit" class="btn-primary w-full" ${U.dis(s.loading)}>
        ${!s.loading ? html`<span>Create Account <i class="fa-solid fa-arrow-right"></i></span>` : ''}
        ${s.loading ? html`<span class="inline-flex items-center gap-2">
          <span class="spinner h-5 w-5 border-2 border-white/40 border-t-white"></span> Creating Account...
        </span>` : ''}
      </button>

      <p class="text-center text-sm text-slate-600">
        Already have an account? <a href="${Nav.href('/login')}" class="font-bold text-zepto-600 hover:text-zepto-700">Sign In</a>
      </p>
    </form>
  </div>
 </div>
 <footer class="border-t border-white/10 px-4 py-5 text-center text-xs font-medium text-white/60">
   &copy; ${this.currentYear} AroundU &middot; Local Logistics &amp; Hyperlocal Retail Platform
 </footer>
</div>

${s.termsOpen ? html`
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onclick="Page.state.termsOpen = false">
    <section class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Terms and Conditions">
      <div class="mb-4 flex items-center justify-between gap-4">
        <h2 class="text-xl font-extrabold text-slate-900">AroundU Terms and Conditions</h2>
        <button type="button" class="btn-icon" onclick="Page.state.termsOpen = false" aria-label="Close terms"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="space-y-3 text-sm leading-6 text-slate-600">
        <p>By creating an AroundU account, you agree to provide accurate account and contact information and to keep your credentials secure.</p>
        <p>Customers must use valid delivery details and payment information. Retailers and fleet owners must provide genuine business, identity, vehicle and verification documents where requested.</p>
        <p>Orders, deliveries, cancellations, refunds and partner verification are processed according to the status shown in the portal. Misuse, fraudulent submissions or prohibited activity may result in account suspension.</p>
        <p>AroundU may retain transaction, support and audit records needed to operate the platform, resolve disputes and maintain security. Users must not attempt to access another account's data or functions.</p>
        <p>By ticking the checkbox, you confirm that you have read and accepted these terms.</p>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.termsOpen = false">Close</button>
        <button type="button" class="btn-primary" onclick="Page.form.controls.agreeTerms.setValue(true); Page.state.termsOpen = false">Accept terms</button>
      </div>
    </section>
  </div>` : ''}`;
    },
  };
})();
