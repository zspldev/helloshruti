import { useUser } from '@clerk/react';
import { UserProfile } from '../models/types';
import { normalizeLanguage } from '../lib/language';

// Profile is stored per-device, keyed by the signed-in Clerk user id so
// multiple accounts on the same browser don't share onboarding preferences.
export const useProfile = () => {
  const { user } = useUser();
  const userId = user?.id;

  const storageKey = userId ? `helloshruti_profile_${userId}` : null;

  const getProfile = (): UserProfile | null => {
    if (!storageKey) return null;
    const data = localStorage.getItem(storageKey);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      const normalizedLanguage = normalizeLanguage(parsed.language);
      // Migrate legacy free-text language values (from before language became
      // a fixed 'en'|'mr'|'hi' code) so old profiles stop 400-ing on every fetch.
      if (parsed.language !== normalizedLanguage) {
        const migrated: UserProfile = { ...parsed, language: normalizedLanguage };
        localStorage.setItem(storageKey, JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const saveProfile = (profile: UserProfile) => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(profile));
  };

  return { getProfile, saveProfile };
};
