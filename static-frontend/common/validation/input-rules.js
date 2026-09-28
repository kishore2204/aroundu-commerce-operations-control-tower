/*
 * Input rules, field hints and the password policy - port of core/validation/*.ts
 * (input-rules.ts, field-hints.ts, password-policy.ts). Same patterns and the same messages.
 */
(function () {
  'use strict';

  const R = (window.InputRules = {});

  R.MOBILE_NUMBER_LENGTH = 10;
  R.MOBILE_NUMBER_PATTERN = /^[0-9]{10}$/;
  R.MOBILE_NUMBER_MESSAGE = 'Mobile number must be 10 digits';
  R.POSTAL_CODE_LENGTH = 6;
  R.POSTAL_CODE_PATTERN = /^[0-9]{6}$/;
  R.POSTAL_CODE_MESSAGE = 'Postal code must be exactly 6 digits';

  function patternValidator(pattern, errorKey) {
    return (control) => {
      const value = control.value;
      if (value === null || value === undefined || value === '') return null;
      return pattern.test(String(value)) ? null : { [errorKey]: true };
    };
  }
  R.mobileNumberValidator = () => patternValidator(R.MOBILE_NUMBER_PATTERN, 'mobileNumber');
  R.postalCodeValidator = () => patternValidator(R.POSTAL_CODE_PATTERN, 'postalCode');

  R.EMAIL_MAX_LENGTH = 160;
  R.EMAIL_PATTERN = /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
  R.EMAIL_REQUIRED_MESSAGE = 'Email is required.';
  R.EMAIL_MESSAGE = 'Enter a valid email address.';
  R.EMAIL_TOO_LONG_MESSAGE = 'Email must not exceed 160 characters.';
  R.normalizeEmail = (value) => String(value ?? '').trim();

  R.GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  R.GSTIN_MAX_LENGTH = 15;
  R.GSTIN_REQUIRED_MESSAGE = 'GST number is required.';
  R.GSTIN_MESSAGE = 'Enter a valid 15-character GSTIN.';
  R.normalizeGstin = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();
  R.sanitizeGstinInput = (value) => String(value ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, R.GSTIN_MAX_LENGTH);

  R.REGISTRATION_PATTERN = /^[A-Z0-9/-]{8,25}$/;
  R.REGISTRATION_REQUIRED_MESSAGE = 'Shop registration number is required.';
  R.REGISTRATION_MESSAGE = 'Enter a valid shop registration number using 8 to 25 letters, numbers, /, or -.';
  R.normalizeRegistration = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

  R.LICENCE_PATTERN = /^[A-Z]{2}[0-9]{2}[0-9]{11,12}$/;
  R.LICENCE_MAX_LENGTH = 16;
  R.LICENCE_REQUIRED_MESSAGE = 'Driving licence number is required.';
  R.LICENCE_MESSAGE = 'Enter a valid driving licence number.';
  R.normalizeLicence = (value) => String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
  R.sanitizeLicenceInput = function (value) {
    const raw = String(value ?? '').toUpperCase();
    let letters = '';
    let digits = '';
    for (const char of raw) {
      if (letters.length < 2) {
        if (/[A-Z]/.test(char)) letters += char;
      } else if (digits.length < R.LICENCE_MAX_LENGTH - 2) {
        if (/[0-9]/.test(char)) digits += char;
      } else {
        break;
      }
    }
    return letters + digits;
  };

  R.VEHICLE_NUMBER_PATTERN = /^(?:[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}|[A-Z]{2}[0-9][A-Z][0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;
  R.VEHICLE_NUMBER_REQUIRED_MESSAGE = 'Vehicle registration number is required.';
  R.VEHICLE_NUMBER_MESSAGE = 'Enter a valid vehicle registration number.';
  R.normalizeVehicleNumber = (value) => String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
  R.VEHICLE_NUMBER_MAX_LENGTH = 10;
  const VEHICLE_SHORT_SERIES_MAX_LENGTH = 8;

  function isShortSeriesVehicle(runs) {
    const [state, rto, series] = runs;
    return runs.length >= 3 && /^[A-Z]{2}$/.test(state ?? '') && /^[0-9]$/.test(rto ?? '') && /^[A-Z]$/.test(series ?? '');
  }
  R.vehicleNumberMaxLength = (plain) =>
    isShortSeriesVehicle(plain.match(/[A-Z]+|[0-9]+/g) ?? []) ? VEHICLE_SHORT_SERIES_MAX_LENGTH : R.VEHICLE_NUMBER_MAX_LENGTH;

  R.formatVehicleNumber = function (value) {
    const plain = R.normalizeVehicleNumber(value);
    if (!/^[A-Z0-9]*$/.test(plain)) return plain;
    const runs = plain.slice(0, R.vehicleNumberMaxLength(plain)).match(/[A-Z]+|[0-9]+/g) ?? [];
    const rto = runs[1] ?? '';
    const series = runs[2] ?? '';
    const number = runs[3];
    if (isShortSeriesVehicle(runs) && (number === undefined || /^[0-9]+$/.test(number))) {
      runs.splice(1, 2, rto + series);
    }
    return runs.join('-');
  };

  R.requiredTrimmed = () => (control) => {
    const value = control.value;
    return value === null || value === undefined || String(value).trim() === '' ? { required: true } : null;
  };

  function normalizedPatternValidator(pattern, normalize, errorKey) {
    return (control) => {
      const value = normalize(control.value);
      if (value === '') return null;
      return pattern.test(value) ? null : { [errorKey]: true };
    };
  }
  R.emailValidator = () => normalizedPatternValidator(R.EMAIL_PATTERN, R.normalizeEmail, 'email');
  R.gstinValidator = () => normalizedPatternValidator(R.GSTIN_PATTERN, R.normalizeGstin, 'gstin');
  R.registrationNumberValidator = () => normalizedPatternValidator(R.REGISTRATION_PATTERN, R.normalizeRegistration, 'registrationNumber');
  R.licenceNumberValidator = () => normalizedPatternValidator(R.LICENCE_PATTERN, R.normalizeLicence, 'licence');
  R.vehicleNumberValidator = () => normalizedPatternValidator(R.VEHICLE_NUMBER_PATTERN, R.normalizeVehicleNumber, 'vehicleNumber');

  R.unlessUnchanged = (original, validator) => (control) =>
    String(control.value ?? '') === String(original() ?? '') ? null : validator(control);

  const IDENTIFIER_MESSAGES = {
    email: { errorKey: 'email', required: R.EMAIL_REQUIRED_MESSAGE, invalid: R.EMAIL_MESSAGE },
    gstin: { errorKey: 'gstin', required: R.GSTIN_REQUIRED_MESSAGE, invalid: R.GSTIN_MESSAGE },
    registration: { errorKey: 'registrationNumber', required: R.REGISTRATION_REQUIRED_MESSAGE, invalid: R.REGISTRATION_MESSAGE },
    licence: { errorKey: 'licence', required: R.LICENCE_REQUIRED_MESSAGE, invalid: R.LICENCE_MESSAGE },
    vehicle: { errorKey: 'vehicleNumber', required: R.VEHICLE_NUMBER_REQUIRED_MESSAGE, invalid: R.VEHICLE_NUMBER_MESSAGE },
  };
  R.identifierError = function (control, kind) {
    if (!(control.touched || control.dirty)) return null;
    const messages = IDENTIFIER_MESSAGES[kind];
    if (control.hasError('required')) return messages.required;
    return control.hasError(messages.errorKey) ? messages.invalid : null;
  };

  /* appFormatInput directive support (see input-directives.js) */
  R.format = function (kind, value) {
    switch (kind) {
      case 'vehicle': return R.formatVehicleNumber(value);
      case 'gstin': return R.sanitizeGstinInput(value);
      case 'registration': return R.normalizeRegistration(value);
      case 'licence': return R.sanitizeLicenceInput(value);
    }
    return value;
  };
  R.isReal = function (kind, char) {
    switch (kind) {
      case 'vehicle': return !/[\s-]/.test(char);
      case 'gstin': return /[0-9a-zA-Z]/.test(char);
      case 'registration': return !/\s/.test(char);
      case 'licence': return /[A-Za-z0-9]/.test(char);
    }
    return true;
  };

  /* password-policy.ts */
  R.PASSWORD_MIN_LENGTH = 8;
  R.PASSWORD_MAX_LENGTH = 72;
  R.passwordChecks = function (value) {
    const password = value ?? '';
    return [
      { key: 'length', label: 'Minimum 8 characters', met: password.length >= R.PASSWORD_MIN_LENGTH && password.length <= R.PASSWORD_MAX_LENGTH },
      { key: 'uppercase', label: 'Uppercase letter', met: /[A-Z]/.test(password) },
      { key: 'lowercase', label: 'Lowercase letter', met: /[a-z]/.test(password) },
      { key: 'number', label: 'Number', met: /[0-9]/.test(password) },
      { key: 'special', label: 'Special character', met: /[^A-Za-z0-9\s]/.test(password) },
    ];
  };
  R.passwordPolicyValidator = () => (control) => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return R.passwordChecks(String(value)).every((check) => check.met) ? null : { passwordPolicy: true };
  };

  /* field-hints.ts */
  R.FIELD_HINTS = {
    gstin: {
      label: 'GST number',
      text: 'GSTIN must contain exactly 15 characters.\nFormat: 2 digits, 5 letters, 4 digits, 1 letter, entity code, Z, and checksum.\nExample: 33ABCDE1234F1Z5',
    },
    vehicleNumber: {
      label: 'vehicle number',
      text: 'Enter a valid Indian vehicle registration number.\nExamples: TN-01-AB-1234, DL-3C-1234, or 22-BH-1234-A.\nThe field stops accepting characters after the valid format length.',
    },
    licence: {
      label: 'driving licence number',
      text: 'Driving licence number must start with 2 letters followed by 13 or 14 digits.\nMaximum: 16 characters.\nExample: TN1234567890123',
    },
    registration: {
      label: 'shop registration number',
      text: 'Use 8 to 25 uppercase letters, digits, /, or -.\nExample: MH/SHOP/2026/1234.\nSpaces are removed automatically.',
    },
    email: { label: 'email address', text: 'Enter a valid email address, for example name@example.com.' },
    mobile: { label: 'mobile number', text: 'Enter exactly 10 digits. Letters, spaces, and special characters are not allowed.' },
    password: {
      label: 'password',
      text: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.',
    },
    confirmPassword: { label: 'password confirmation', text: 'Re-enter exactly the same password.' },
    postalCode: { label: 'postal code', text: 'Enter exactly 6 digits.' },
    sku: {
      label: 'SKU',
      text: 'Use 3 to 20 letters, digits, hyphens (-) or underscores (_).\nEach SKU must be unique in your catalogue.\nExample: RICE-5KG',
    },
    price: { label: 'price', text: 'Enter a price greater than 0, with at most 2 decimal places.\nExample: 125.50' },
    stock: { label: 'stock', text: 'Enter a whole number, 0 or more.' },
    lowStock: { label: 'low stock threshold', text: 'Optional. Enter a whole number, 0 or more.' },
    weight: { label: 'weight', text: 'Weight in kilograms (kg), greater than 0, with up to 3 decimal places.\nExample: 0.5 for 500 g.' },
    vehicleCapacity: { label: 'vehicle capacity', text: 'Load capacity in kilograms (kg). Enter a number of at least 1.' },
  };
})();
