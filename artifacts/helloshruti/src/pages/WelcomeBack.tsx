import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { useWelcomeBack } from '@/hooks/use-welcome-back';
import ShrutiAvatar from '@/components/ShrutiAvatar';

// A once-a-day pit stop between sign-in and the Dashboard for returning
// users. Without it, a returning user landed straight on a dense reading
// list with no greeting at all — this restores a bit of the warmth new
// users get on the landing page, without adding friction on every open
// (it marks itself seen for the day and skips itself after that).
export default function WelcomeBack() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { getProfile } = useProfile();
  const { markShownToday } = useWelcomeBack();

  const profile = getProfile();
  const name = profile?.name || user?.firstName || user?.fullName;

  useEffect(() => {
    markShownToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center max-w-2xl mx-auto">
      <ShrutiAvatar className="w-28 h-28 md:w-32 md:h-32 mb-8" />
      <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight mb-6">
        Welcome back{name ? `, ${name}` : ''}.
      </h1>
      <p className="text-xl text-muted-foreground mb-12 leading-relaxed">
        I've been keeping an eye on things for you.
      </p>
      <Button size="lg" className="text-lg h-14 px-8" onClick={() => setLocation('/dashboard')}>
        Continue to Today's Reading
      </Button>
    </div>
  );
}
