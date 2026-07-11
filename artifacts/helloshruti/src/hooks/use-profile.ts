import { UserProfile } from '../models/types';

export const useProfile = () => {
  const getProfile = (): UserProfile | null => {
    const data = localStorage.getItem('helloshruti_profile');
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  const saveProfile = (profile: UserProfile) => {
    localStorage.setItem('helloshruti_profile', JSON.stringify(profile));
  };

  return { getProfile, saveProfile };
};