import { useEffect, useRef, useState } from 'react';
import { basePath } from '@/lib/base-path';
import ShrutiAvatar from '@/components/ShrutiAvatar';

const SESSION_KEY = 'shruti-opening-clip-played';

interface ShrutiIntroProps {
  className?: string;
}

// Plays Shruti's 4-second opening clip once per browser session on the main
// landing page, then settles on her static headshot. Muted + playsInline so
// it autoplays reliably in browsers and inside an installed PWA.
export default function ShrutiIntro({ className = 'w-28 h-28 md:w-32 md:h-32' }: ShrutiIntroProps) {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setShowVideo(true);
    }
  }, []);

  if (!showVideo) {
    return <ShrutiAvatar className={`${className} shadow-md ring-4 ring-white`} />;
  }

  return (
    <video
      ref={videoRef}
      className={`rounded-full object-cover object-top shrink-0 shadow-md ring-4 ring-white ${className}`}
      src={`${basePath}/shruti-opening.mp4`}
      autoPlay
      muted
      playsInline
      onEnded={() => {
        sessionStorage.setItem(SESSION_KEY, '1');
        setShowVideo(false);
      }}
    />
  );
}
