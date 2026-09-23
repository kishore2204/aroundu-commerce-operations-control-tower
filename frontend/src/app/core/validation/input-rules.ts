import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The single definition of the application-wide input rules. The backend enforces the same rules
 * (S1 UserAccountService / UserAccountRequestDto, S3 AddressRequest, S4 LogisticsBookingDetailService),
 * so a value the screen accepts is a value the server accepts.
 */

/** A mobile number is exactly 10 digits - no letters, spaces or symbols. */
export const MOBILE_NUMBER_LENGTH = 10;
export const MOBILE_NUMBER_PATTERN = /^[0-9]{10}$/;
export const MOBILE_NUMBER_MESSAGE = 'Mobile number must be 10 digits';

/** A postal code (PIN code) is exactly 6 digits. */
export const POSTAL_CODE_LENGTH = 6;
export const POSTAL_CODE_PATTERN = /^[0-9]{6}$/;
export const POSTAL_CODE_MESSAGE = 'Postal code must be exactly 6 digits';

/** Empty values are left to `Validators.required`; anything else must match the pattern exactly. */
function patternValidator(pattern: RegExp, errorKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return pattern.test(String(value)) ? null : { [errorKey]: true };
  };
}

export const mobileNumberValidator = (): ValidatorFn => patternValidator(MOBILE_NUMBER_PATTERN, 'mobileNumber');
export const postalCodeValidator = (): ValidatorFn => patternValidator(POSTAL_CODE_PATTERN, 'postalCode');

/* ------------------------------------------------------------------------------------------------------------------
 * Identifiers. The server (S1 EmailRule, S2 BusinessIdentifierRules, S5 FleetIdentifierRules) applies the same patterns
 * and is the one that decides; these give the user the message straight away. Each value is normalised the way the
 * server stores it BEFORE it is checked and sent, so what is validated is what is saved.
 * ---------------------------------------------------------------------------------------------------------------- */

/** An e-mail address: user@example.com, first.last@example.co.in, user+tag@example.com - a domain with a real top level. */
export const EMAIL_MAX_LENGTH = 160;
export const EMAIL_PATTERN = /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
export const EMAIL_REQUIRED_MESSAGE = 'Email is required.';
export const EMAIL_MESSAGE = 'Enter a valid email address.';
export const EMAIL_TOO_LONG_MESSAGE = 'Email must not exceed 160 characters.';
export const normalizeEmail = (value: unknown): string => String(value ?? '').trim();

/** GSTIN: 2-digit state code + PAN (5 letters, 4 digits, 1 letter) + entity number + Z + check character, e.g. 33ABCDE1234F1Z5. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const GSTIN_MAX_LENGTH = 15;
export const GSTIN_REQUIRED_MESSAGE = 'GST number is required.';
export const GSTIN_MESSAGE = 'Enter a valid 15-character GSTIN.';
export const normalizeGstin = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').toUpperCase();

/**
 * Typing-time sanitizer for a GSTIN: keeps only letters and digits, upper-cased, and never lets the value grow past
 * {@link GSTIN_MAX_LENGTH} - a 16th character (typed or pasted) simply cannot enter the field. Structure (which
 * position must be a digit vs. a letter) is still left to {@link gstinValidator}, which reports it with GSTIN_MESSAGE.
 */
export const sanitizeGstinInput = (value: unknown): string =>
  String(value ?? '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, GSTIN_MAX_LENGTH);

/**
 * Shop registration / Gumasta licence number: 8 to 25 upper-case letters, digits, slashes or hyphens (MH/SHOP/2026/1234,
 * TN-REG-2026-4421). These numbers differ a lot from state to state, so only the character set and length are checked.
 * Spaces are removed and letters upper-cased before the check.
 */
export const REGISTRATION_PATTERN = /^[A-Z0-9/-]{8,25}$/;
export const REGISTRATION_REQUIRED_MESSAGE = 'Shop registration number is required.';
export const REGISTRATION_MESSAGE = 'Enter a valid shop registration number using 8 to 25 letters, numbers, /, or -.';
export const normalizeRegistration = (value: unknown): string => String(value ?? '').replace(/\s+/g, '').toUpperCase();

/**
 * Indian driving licence: 2 state letters, 2 digits, then 11 or 12 more digits (15 or 16 characters), e.g. TN1420110012345 or
 * KA05201200123456. Not tied to one state's layout. Spaces and hyphens are removed and letters upper-cased before the check.
 */
export const LICENCE_PATTERN = /^[A-Z]{2}[0-9]{2}[0-9]{11,12}$/;
export const LICENCE_MAX_LENGTH = 16;
export const LICENCE_REQUIRED_MESSAGE = 'Driving licence number is required.';
export const LICENCE_MESSAGE = 'Enter a valid driving licence number.';
export const normalizeLicence = (value: unknown): string => String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();

/**
 * Typing-time sanitizer for a driving licence number: the first 2 characters may only be letters, everything after
 * that may only be digits, and the result never grows past {@link LICENCE_MAX_LENGTH} (2 letters + 14 digits) - a
 * digit typed before the 2 letters are done, a letter typed after them, a space, a hyphen or any other character is
 * dropped on the spot rather than shown and rejected later. Whether there end up being 13 or 14 digits (both valid)
 * is still left to {@link licenceNumberValidator}.
 */
export function sanitizeLicenceInput(value: unknown): string {
  const raw = String(value ?? '').toUpperCase();
  let letters = '';
  let digits = '';
  for (const char of raw) {
    if (letters.length < 2) {
      if (/[A-Z]/.test(char)) letters += char;
    } else if (digits.length < LICENCE_MAX_LENGTH - 2) {
      if (/[0-9]/.test(char)) digits += char;
    } else {
      break;
    }
  }
  return letters + digits;
}

/**
 * Indian vehicle registration - three layouts, anchored as ONE group so ^ and $ apply to every one of them:
 * standard MH12AB1234 / KA05JK4471, single-letter series DL3C1234, Bharat series 22BH1234A / 22BH1234AB.
 * (Same rule as S2 BusinessIdentifierRules and S5 FleetIdentifierRules.)
 */
export const VEHICLE_NUMBER_PATTERN = /^(?:[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}|[A-Z]{2}[0-9][A-Z][0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;
export const VEHICLE_NUMBER_REQUIRED_MESSAGE = 'Vehicle registration number is required.';
export const VEHICLE_NUMBER_MESSAGE = 'Enter a valid vehicle registration number.';
export const normalizeVehicleNumber = (value: unknown): string => String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();

/** The longest of the three supported normalized layouts (standard 2-letter series, or Bharat 2-letter ending). */
export const VEHICLE_NUMBER_MAX_LENGTH = 10;
/** DL3C1234-style layout: state + a single-digit RTO + ONE series letter + 4 digits - shorter than the others. */
const VEHICLE_SHORT_SERIES_MAX_LENGTH = 8;

/**
 * True once state + RTO + series unambiguously match the short single-letter-series layout (e.g. DL3C1234): a
 * single-digit RTO immediately followed by exactly one series letter. Shared by the hyphen formatting below and by
 * {@link vehicleNumberMaxLength}, so the cap and the display grouping never disagree on which layout was typed.
 */
function isShortSeriesVehicle(runs: string[]): boolean {
  const [state, rto, series] = runs;
  return runs.length >= 3 && /^[A-Z]{2}$/.test(state ?? '') && /^[0-9]$/.test(rto ?? '') && /^[A-Z]$/.test(series ?? '');
}

/** The maximum normalized length for the format the entered prefix looks like: 8 for DL3C1234-style, 10 otherwise. */
export function vehicleNumberMaxLength(plain: string): number {
  return isShortSeriesVehicle(plain.match(/[A-Z]+|[0-9]+/g) ?? []) ? VEHICLE_SHORT_SERIES_MAX_LENGTH : VEHICLE_NUMBER_MAX_LENGTH;
}

/**
 * The display form of a vehicle number: TN01AB1234 -> TN-01-AB-1234, DL3C1234 -> DL-3C-1234, 22BH1234A -> 22-BH-1234-A.
 * Works on a partly typed value too (TN01A -> TN-01-A), so it can be applied while the user types. The value is split into
 * runs of letters and digits; a single-digit RTO followed by ONE series letter (the DL3C1234 layout) stays together. A value
 * with any other character is only upper-cased (the validator then reports it), never mangled.
 * Also stops accepting normalized characters once {@link vehicleNumberMaxLength} for the detected format is reached, so
 * typing or pasting past the valid format length (e.g. TN01AB00442222222) cannot leave extra digits/letters in the field.
 * The stored / sent value is always the plain `normalizeVehicleNumber` form - this is display only.
 */
export function formatVehicleNumber(value: unknown): string {
  const plain = normalizeVehicleNumber(value);
  if (!/^[A-Z0-9]*$/.test(plain)) return plain;
  const runs = plain.slice(0, vehicleNumberMaxLength(plain)).match(/[A-Z]+|[0-9]+/g) ?? [];
  const [, rto = '', series = '', number] = runs;
  if (isShortSeriesVehicle(runs) && (number === undefined || /^[0-9]+$/.test(number))) {
    runs.splice(1, 2, rto + series);
  }
  return runs.join('-');
}

/** "Required" that also counts a value made only of spaces as missing (Validators.required does not). */
export const requiredTrimmed = (): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  return value === null || value === undefined || String(value).trim() === '' ? { required: true } : null;
};

/** Empty values are left to `requiredTrimmed`; anything else must match after it is normalised. */
function normalizedPatternValidator(pattern: RegExp, normalize: (value: unknown) => string, errorKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = normalize(control.value);
    if (value === '') return null;
    return pattern.test(value) ? null : { [errorKey]: true };
  };
}

export const emailValidator = (): ValidatorFn => normalizedPatternValidator(EMAIL_PATTERN, normalizeEmail, 'email');
export const gstinValidator = (): ValidatorFn => normalizedPatternValidator(GSTIN_PATTERN, normalizeGstin, 'gstin');
export const registrationNumberValidator = (): ValidatorFn =>
  normalizedPatternValidator(REGISTRATION_PATTERN, normalizeRegistration, 'registrationNumber');
export const licenceNumberValidator = (): ValidatorFn => normalizedPatternValidator(LICENCE_PATTERN, normalizeLicence, 'licence');
export const vehicleNumberValidator = (): ValidatorFn =>
  normalizedPatternValidator(VEHICLE_NUMBER_PATTERN, normalizeVehicleNumber, 'vehicleNumber');

/**
 * Applies `validator` only when the value has been CHANGED from what was loaded. An edit form that resends a stored value the
 * user did not touch (the server does the same) must not be blocked by a value saved before a rule existed.
 */
export const unlessUnchanged =
  (original: () => unknown, validator: ValidatorFn): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '') === String(original() ?? '') ? null : validator(control);

/** The message under an identifier field once it has been touched or typed in ("required" first, then "invalid"); otherwise null. */
export type IdentifierKind = 'email' | 'gstin' | 'registration' | 'licence' | 'vehicle';
const IDENTIFIER_MESSAGES: Record<IdentifierKind, { errorKey: string; required: string; invalid: string }> = {
  email: { errorKey: 'email', required: EMAIL_REQUIRED_MESSAGE, invalid: EMAIL_MESSAGE },
  gstin: { errorKey: 'gstin', required: GSTIN_REQUIRED_MESSAGE, invalid: GSTIN_MESSAGE },
  registration: { errorKey: 'registrationNumber', required: REGISTRATION_REQUIRED_MESSAGE, invalid: REGISTRATION_MESSAGE },
  licence: { errorKey: 'licence', required: LICENCE_REQUIRED_MESSAGE, invalid: LICENCE_MESSAGE },
  vehicle: { errorKey: 'vehicleNumber', required: VEHICLE_NUMBER_REQUIRED_MESSAGE, invalid: VEHICLE_NUMBER_MESSAGE },
};

export function identifierError(control: AbstractControl, kind: IdentifierKind): string | null {
  if (!(control.touched || control.dirty)) return null;
  const messages = IDENTIFIER_MESSAGES[kind];
  if (control.hasError('required')) return messages.required;
  return control.hasError(messages.errorKey) ? messages.invalid : null;
}
