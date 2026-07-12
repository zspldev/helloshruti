import { useUser } from '@clerk/react';
import { useProfile } from '@/hooks/use-profile';

interface UserNameProps {
  className?: string;
}

// Displays the signed-in user's name on the right side of a page header.
// Prefers the name the user typed during onboarding (most likely to be their
// full name), then Clerk's profile fields. Deliberately never falls back to
// showing the email address — an email isn't a name.
export default function UserName({ className = 'text-sm font-medium' }: UserNameProps) {
  const { user } = useUser();
  const { getProfile } = useProfile();
  if (!user) return null;

  const profile = getProfile();
  const name = profile?.name || user.fullName || user.firstName || user.username;

  if (!name) return null;

  return <span className={`truncate ${className}`}>{name}</span>;
}
