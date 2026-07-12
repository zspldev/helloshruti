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
