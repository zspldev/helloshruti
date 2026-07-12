import { useEffect, useRef, useState } from 'react';
import { Article } from '@/models/types';
import { voiceService } from '@/services/voiceService';
import { getExplainText, getSummaryText, getFullReadText, estimateSeconds } from '@/lib/narration';
import { SkipBack, SkipForward, Play, Pause, Square, ChevronLeft, ChevronRight, Headphones } from 'lucide-react';
import { Button } from './ui/button';

export type ListenMode = 'explain' | 'summary' | 'full';

interface ListenEventDetail {
  articles: Article[];
  articleId: string;
  mode: ListenMode;
}

const MODE_LABEL: Record<ListenMode, string> = {
  explain: 'Explain',
  summary: 'Summary',
  full: 'Full Read',
};

function getModeText(article: Article, mode: ListenMode): string {
  if (mode === 'explain') return getExplainText(article);
  if (mode === 'summary') return getSummaryText(article);
  return getFullReadText(article);
}

// A single, consistent "now playing" surface for Explain, Summary, and Full
// Read in listen mode — whichever of the three the user taps, this is the
// page that appears, so the experience doesn't shift shape between them.
export default function ListenPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<ListenMode>('full');
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const currentArticle = articles[currentIndex] ?? null;
  const currentText = currentArticle ? getModeText(currentArticle, mode) : '';
  const totalSeconds = currentText ? estimateSeconds(currentText) : 0;

  const clearTicker = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTicker = () => {
    clearTicker();
    intervalRef.current = window.setInterval(() => {
      setElapsed((prev) => Math.min(prev + 1, totalSeconds));
    }, 1000);
  };

  const speak = (article: Article, m: ListenMode) => {
    clearTicker();
    setElapsed(0);
    setFinished(false);
    setIsPlaying(true);
    voiceService.speak(getModeText(article, m), () => {
      clearTicker();
      setIsPlaying(false);
      setFinished(true);
      setElapsed(estimateSeconds(getModeText(article, m)));
    });
    startTicker();
  };

  useEffect(() => {
    const handleListen = (e: Event) => {
      const detail = (e as CustomEvent<ListenEventDetail>).detail;
      if (!detail?.articleId) return;
      const list = detail.articles?.length ? detail.articles : [];
      const idx = list.findIndex((a) => a.id === detail.articleId);
      const finalList = idx >= 0 ? list : list.concat();
      const finalIdx = idx >= 0 ? idx : 0;
      setArticles(finalList);
      setCurrentIndex(finalIdx);
      setMode(detail.mode);
      setIsOpen(true);
      const article = finalList[finalIdx];
      if (article) speak(article, detail.mode);
    };

    window.addEventListener('shruti:listen', handleListen);
    return () => window.removeEventListener('shruti:listen', handleListen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the OS-level media controls (lock screen, hardware/Bluetooth media
  // keys, notification widget) in sync with what's on screen — this is the
  // "audio controls" surface in addition to the on-screen buttons below.
  useEffect(() => {
    if (!isOpen || !currentArticle || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${MODE_LABEL[mode]}: ${currentArticle.title}`,
      artist: currentArticle.source,
    });
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('stop', () => stop());
    navigator.mediaSession.setActionHandler('previoustrack', () => goToStory(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => goToStory(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentArticle?.id, mode, isPlaying]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToStory(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToStory(1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        restart();
      } else if (e.key === 'End') {
        e.preventDefault();
        skipToEnd();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPlaying, currentIndex, articles, mode]);

  useEffect(() => () => clearTicker(), []);

  if (!isOpen || !currentArticle) return null;

  const restart = () => {
    speak(currentArticle, mode);
  };

  const togglePlayPause = () => {
    if (finished) {
      restart();
      return;
    }
    if (isPlaying) {
      voiceService.pauseSpeaking();
      clearTicker();
      setIsPlaying(false);
    } else {
      voiceService.resumeSpeaking();
      setIsPlaying(true);
      startTicker();
    }
  };

  const skipToEnd = () => {
    voiceService.stopSpeaking();
    clearTicker();
    setIsPlaying(false);
    setFinished(true);
    setElapsed(totalSeconds);
  };

  const goToStory = (delta: 1 | -1) => {
    if (articles.length === 0) return;
    const nextIndex = (currentIndex + delta + articles.length) % articles.length;
    setCurrentIndex(nextIndex);
    speak(articles[nextIndex], mode);
  };

  const stop = () => {
    voiceService.stopSpeaking();
    clearTicker();
    setIsOpen(false);
    setIsPlaying(false);
  };

  const progressPct = totalSeconds > 0 ? Math.min(100, Math.round((elapsed / totalSeconds) * 100)) : 0;
  const canNavigate = articles.length > 1;

  return (
    <div
      role="region"
      aria-label="Listen player"
      className="fixed inset-x-0 bottom-0 z-50 bg-primary text-primary-foreground rounded-t-3xl shadow-[0_-10px_40px_rgba(30,63,32,0.25)] px-6 pt-5 pb-6 md:pb-8 animate-in slide-in-from-bottom duration-300"
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p data-testid="listen-player-mode" className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
                {MODE_LABEL[mode]} &middot; {currentArticle.source}
              </p>
              <p data-testid="listen-player-title" className="text-lg font-serif leading-snug truncate">{currentArticle.title}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={stop}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/15 shrink-0"
            title="Stop"
            aria-label="Stop listening"
          >
            <Square className="w-5 h-5" />
          </Button>
        </div>

        <p
          data-testid="listen-player-text"
          className="text-sm text-primary-foreground/80 leading-relaxed mb-4 max-h-24 overflow-y-auto"
        >
          {currentText}
        </p>

        <div
          className="h-1.5 w-full rounded-full bg-primary-foreground/20 mb-5 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div className="h-full bg-primary-foreground rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex items-center justify-center gap-3 md:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToStory(-1)}
            disabled={!canNavigate}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/15 disabled:opacity-30"
            title="Previous story"
            aria-label="Previous story"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={restart}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/15"
            title="Restart (beginning)"
            aria-label="Restart from the beginning"
          >
            <SkipBack className="w-5 h-5" />
          </Button>

          <Button
            size="iconLg"
            onClick={togglePlayPause}
            className="rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-md"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={skipToEnd}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/15"
            title="Skip to end"
            aria-label="Skip to the end"
          >
            <SkipForward className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToStory(1)}
            disabled={!canNavigate}
            className="rounded-full text-primary-foreground hover:bg-primary-foreground/15 disabled:opacity-30"
            title="Next story"
            aria-label="Next story"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>

        <p className="text-center text-xs text-primary-foreground/60 mt-4">
          Space to play/pause &middot; ←/→ for previous/next story &middot; Home/End to restart or skip &middot; Esc to stop
        </p>
      </div>
    </div>
  );
}
