/**
 * The requirement text behind the (i) information icon next to an important input (see FieldHintComponent). One place, so
 * a rule and the sentence that explains it are edited together. These describe the rules the server enforces
 * (input-rules.ts / password-policy.ts on the screen; S1, S2, S3, S5 on the server) - the icon only helps the user get it
 * right first time, the field's own error message stays the actual validation feedback.
 */
export interface FieldHint {
  /** Used in the icon's accessible name: "Show GST number requirements". */
  label: string;
  /** Shown in the tooltip; a line break starts a new line. */
  text: string;
}

export const FIELD_HINTS = {
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
  email: {
    label: 'email address',
    text: 'Enter a valid email address, for example name@example.com.',
  },
  mobile: {
    label: 'mobile number',
    text: 'Enter exactly 10 digits. Letters, spaces, and special characters are not allowed.',
  },
  password: {
    label: 'password',
    text: 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.',
  },
  confirmPassword: {
    label: 'password confirmation',
    text: 'Re-enter exactly the same password.',
  },
  postalCode: {
    label: 'postal code',
    text: 'Enter exactly 6 digits.',
  },
  sku: {
    label: 'SKU',
    text: 'Use 3 to 20 letters, digits, hyphens (-) or underscores (_).\nEach SKU must be unique in your catalogue.\nExample: RICE-5KG',
  },
  price: {
    label: 'price',
    text: 'Enter a price greater than 0, with at most 2 decimal places.\nExample: 125.50',
  },
  stock: {
    label: 'stock',
    text: 'Enter a whole number, 0 or more.',
  },
  lowStock: {
    label: 'low stock threshold',
    text: 'Optional. Enter a whole number, 0 or more.',
  },
  weight: {
    label: 'weight',
    text: 'Weight in kilograms (kg), greater than 0, with up to 3 decimal places.\nExample: 0.5 for 500 g.',
  },
  vehicleCapacity: {
    label: 'vehicle capacity',
    text: 'Load capacity in kilograms (kg). Enter a number of at least 1.',
  },
} as const satisfies Record<string, FieldHint>;

export type FieldHintKey = keyof typeof FIELD_HINTS;
