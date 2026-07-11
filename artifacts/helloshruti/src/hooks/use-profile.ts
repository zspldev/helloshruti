import { useUser } from '@clerk/react';
import { UserProfile } from '../models/types';

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
      return JSON.parse(data);
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
