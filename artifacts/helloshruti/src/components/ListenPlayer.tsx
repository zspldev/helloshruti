import { useEffect, useRef, useState } from 'react';
import { Article } from '@/models/types';
import { voiceService } from '@/services/voiceService';
import { getExplainText, getSummaryText, getFullReadText, estimateSeconds } from '@/lib/narration';
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Headphones,
  Loader2,
} from 'lucide-react';
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
  // True from the moment "play" is requested until audio actually starts —
  // the backend TTS call is uncached and can take several seconds, so without
  // this the player looked like it was already playing while it was really
  // still silently fetching, which read as "no sound at all" on first use.
  const [isBuffering, setIsBuffering] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  // Collapsed by default: this is a compact "now playing" dock, not a takeover
  // sheet, so it never hides the story list or the article's image behind it.
  // Expanding is an explicit choice for anyone who wants the read-along text
  // or the extra transport controls.
  const [expanded, setExpanded] = useState(false);

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
    setIsBuffering(true);
    voiceService.speak(
      getModeText(article, m),
      article.language,
      () => {
        clearTicker();
        setIsPlaying(false);
        setIsBuffering(false);
        setFinished(true);
        setElapsed(estimateSeconds(getModeText(article, m)));
      },
      () => {
        setIsBuffering(false);
        startTicker();
      },
    );
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
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 pointer-events-none">
      <div
        role="region"
        aria-label="Listen player"
        className="pointer-events-auto w-full max-w-2xl bg-primary text-primary-foreground rounded-2xl shadow-[0_10px_40px_rgba(30,63,32,0.35)] overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        {/* Slim progress bar — always visible, doubles as the top edge of the dock */}
        <div
          className="h-1 w-full bg-primary-foreground/20"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
        >
          <div className="h-full bg-primary-foreground transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Compact bar: mode, title, and core transport controls only — this is
            what's on screen by default so the story/image behind it stays visible. */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse listen player' : 'Expand listen player'}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left rounded-lg hover:bg-primary-foreground/10 -m-1 p-1"
          >
            <div className="w-9 h-9 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p data-testid="listen-player-mode" className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/70 truncate">
                {isBuffering ? "Loading Shruti's voice..." : `${MODE_LABEL[mode]} \u00b7 ${currentArticle.source}`}
              </p>
              <p data-testid="listen-player-title" className="text-sm font-serif leading-snug truncate">{currentArticle.title}</p>
            </div>
            {expanded ? <ChevronDown className="w-4 h-4 shrink-0 opacity-70" /> : <ChevronUp className="w-4 h-4 shrink-0 opacity-70" />}
          </button>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToStory(-1)}
              disabled={!canNavigate}
              className="rounded-full w-8 h-8 text-primary-foreground hover:bg-primary-foreground/15 disabled:opacity-30"
              title="Previous story"
              aria-label="Previous story"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <Button
              size="icon"
              onClick={togglePlayPause}
              disabled={isBuffering}
              className="rounded-full w-9 h-9 bg-primary-foreground text-primary hover:bg-primary-foreground/90 disabled:opacity-70"
              title={isBuffering ? "Loading Shruti's voice..." : isPlaying ? 'Pause' : 'Play'}
              aria-label={isBuffering ? "Loading Shruti's voice" : isPlaying ? 'Pause' : 'Play'}
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToStory(1)}
              disabled={!canNavigate}
              className="rounded-full w-8 h-8 text-primary-foreground hover:bg-primary-foreground/15 disabled:opacity-30"
              title="Next story"
              aria-label="Next story"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={stop}
              className="rounded-full w-8 h-8 text-primary-foreground hover:bg-primary-foreground/15"
              title="Stop"
              aria-label="Stop listening"
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Expanded panel: read-along text and secondary controls, opened on request */}
        {expanded && (
          <div className="px-4 pb-4 pt-1 border-t border-primary-foreground/10 animate-in fade-in slide-in-from-top-1 duration-150">
            <p
              data-testid="listen-player-text"
              className="text-sm text-primary-foreground/80 leading-relaxed mb-3 mt-3 max-h-28 overflow-y-auto"
            >
              {currentText}
            </p>

            <div className="flex items-center justify-center gap-4">
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
                variant="ghost"
                size="icon"
                onClick={skipToEnd}
                className="rounded-full text-primary-foreground hover:bg-primary-foreground/15"
                title="Skip to end"
                aria-label="Skip to the end"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            <p className="text-center text-[11px] text-primary-foreground/60 mt-3">
              Space to play/pause &middot; ←/→ for previous/next story &middot; Home/End to restart or skip &middot; Esc to stop
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
