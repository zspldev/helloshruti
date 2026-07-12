import { useUser } from '@clerk/react';

// Tracks whether the signed-in user has already seen the "Welcome back"
// screen today. Keyed per Clerk user id (like the profile) and per calendar
// day (YYYY-MM-DD, local time) so it resurfaces once each day rather than on
// every app open — a daily welcome feels warm, one on every open would just
// be an extra tap between the user and their reading list.
export const useWelcomeBack = () => {
  const { user } = useUser();
  const userId = user?.id;

  const storageKey = userId ? `helloshruti_welcome_shown_${userId}` : null;

  const todayKey = (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  };

  const wasShownToday = (): boolean => {
    if (!storageKey) return false;
    return localStorage.getItem(storageKey) === todayKey();
  };

  const markShownToday = () => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, todayKey());
  };

  return { wasShownToday, markShownToday };
};
