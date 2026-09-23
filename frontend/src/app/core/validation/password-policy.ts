import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * The password policy shown to the user and enforced by the backend (S1 PasswordPolicy). Both sides use the
 * same five rules: at least 8 characters (72 at most, the existing limit), an uppercase letter, a lowercase
 * letter, a digit and a special character (anything that is not a letter, digit or whitespace).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export interface PasswordCheck {
  key: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  met: boolean;
}

export function passwordChecks(value: string | null | undefined): PasswordCheck[] {
  const password = value ?? '';
  return [
    { key: 'length', label: 'Minimum 8 characters', met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { key: 'uppercase', label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { key: 'lowercase', label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { key: 'number', label: 'Number', met: /[0-9]/.test(password) },
    { key: 'special', label: 'Special character', met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

export function passwordPolicyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null; // `required` reports empty
    return passwordChecks(String(value)).every((check) => check.met) ? null : { passwordPolicy: true };
  };
}
