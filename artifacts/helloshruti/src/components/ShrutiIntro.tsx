import { useEffect, useRef, useState } from 'react';
import { basePath } from '@/lib/base-path';
import ShrutiAvatar from '@/components/ShrutiAvatar';
import { Volume2 } from 'lucide-react';

const SESSION_KEY = 'shruti-opening-clip-played';

interface ShrutiIntroProps {
  className?: string;
}

// Plays Shruti's 4-second opening clip once per browser session on the main
// landing page, with real audio (not muted). Browsers only allow *unmuted*
// autoplay in direct response to a user gesture — there's no way to have a
// video with sound start on its own the instant the page loads — so instead
// of a muted autoplay we wait for the visitor to tap the avatar once, then
// play the clip unmuted from that same tap. Falls back to (and settles on)
// her static headshot before the first tap and after the clip finishes.
export default function ShrutiIntro({ className = 'w-28 h-28 md:w-32 md:h-32' }: ShrutiIntroProps) {
  const [status, setStatus] = useState<'idle' | 'playing' | 'done'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setStatus('done');
    }
  }, []);

  const playClip = () => {
    setStatus('playing');
  };

  useEffect(() => {
    if (status === 'playing' && videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().catch(() => {
        // Autoplay-with-sound was blocked for some reason (e.g. rapid double
        // tap) — settle on the headshot rather than getting stuck silently.
        sessionStorage.setItem(SESSION_KEY, '1');
        setStatus('done');
      });
    }
  }, [status]);

  if (status === 'idle') {
    return (
      <button
        type="button"
        onClick={playClip}
        aria-label="Play Shruti's welcome message with sound"
        className={`relative rounded-full shrink-0 shadow-md ring-4 ring-white group ${className}`}
      >
        <ShrutiAvatar className={`w-full h-full ${className}`} />
        <span className="absolute inset-0 rounded-full bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Volume2 className="w-7 h-7 text-white" />
        </span>
        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-white animate-pulse">
          <Volume2 className="w-3.5 h-3.5" />
        </span>
      </button>
    );
  }

  if (status === 'done') {
    return <ShrutiAvatar className={`${className} shadow-md ring-4 ring-white`} />;
  }

  return (
    <video
      ref={videoRef}
      className={`rounded-full object-cover object-top shrink-0 shadow-md ring-4 ring-white ${className}`}
      src={`${basePath}/shruti-opening.mp4`}
      playsInline
      onEnded={() => {
        sessionStorage.setItem(SESSION_KEY, '1');
        setStatus('done');
      }}
    />
  );
}
