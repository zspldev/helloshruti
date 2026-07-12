import { useUser } from '@clerk/react';

interface UserNameProps {
  className?: string;
}

// Displays the signed-in user's full name (falling back to first name, then
// username/email) on the right side of a page header.
export default function UserName({ className = 'text-sm font-medium' }: UserNameProps) {
  const { user } = useUser();
  if (!user) return null;

  const name =
    user.fullName || user.firstName || user.username || user.primaryEmailAddress?.emailAddress;

  if (!name) return null;

  return <span className={`truncate ${className}`}>{name}</span>;
}
