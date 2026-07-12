import { basePath } from '@/lib/base-path';

interface ShrutiAvatarProps {
  className?: string;
}

// Shruti's headshot photo, used both as the large hero image next to "Hello.
// I'm Shruti." and as a small circular thumbnail on every other page.
export default function ShrutiAvatar({ className = 'w-10 h-10' }: ShrutiAvatarProps) {
  return (
    <img
      src={`${basePath}/shruti-headshot.jpg`}
      alt="Shruti"
      className={`rounded-full object-cover object-top shrink-0 ${className}`}
    />
  );
}
