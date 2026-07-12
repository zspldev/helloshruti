import { LanguageCode } from '@/models/types';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'mr', label: 'मराठी' },
  { code: 'hi', label: 'हिंदी' },
];

export function languageLabel(code: LanguageCode): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.label ?? code;
}

const VALID_CODES: readonly string[] = LANGUAGE_OPTIONS.map((l) => l.code);

// Profiles created before language became a fixed 'en'|'mr'|'hi' code stored
// free-text values (e.g. "English", "मराठी (Marathi)") in localStorage. The
// backend now validates this as a strict enum and rejects anything else with
// a 400, which otherwise surfaces to already-onboarded users as "couldn't
// reach the news feed". Normalize any legacy/unrecognized value to a valid
// code so old profiles keep working without forcing users to re-onboard.
export function normalizeLanguage(value: unknown): LanguageCode {
  if (typeof value === 'string' && (VALID_CODES as string[]).includes(value)) {
    return value as LanguageCode;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.startsWith('mar') || value.includes('मराठी')) return 'mr';
    if (lower.startsWith('hin') || value.includes('हिंदी')) return 'hi';
    if (lower.startsWith('eng')) return 'en';
  }
  return 'en';
}
