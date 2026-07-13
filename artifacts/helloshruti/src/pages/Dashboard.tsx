import { useState } from 'react';
import { useListArticles, getListArticlesQueryKey } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { useClerk } from '@clerk/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useProfile } from '@/hooks/use-profile';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  History as HistoryIcon,
  Mic,
  RefreshCw,
  LogOut,
  Lightbulb,
  FileText,
  BookOpenText,
  Headphones,
  Eye,
  Languages,
} from 'lucide-react';
import { Article } from '@/models/types';
import { articleService } from '@/services/articleService';
import { getExplainText, getSummaryText, estimateSeconds, formatDuration } from '@/lib/narration';
import { languageLabel } from '@/lib/language';
import { formatLongDate } from '@/lib/date';
import { FEATURES } from '@/config/features';
import ShrutiAvatar from '@/components/ShrutiAvatar';
import UserName from '@/components/UserName';

type Mode = 'read' | 'listen';
type PanelType = 'explain' | 'summary';

export default function Dashboard() {
  const { getProfile } = useProfile();
  const profile = getProfile();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // "Read" shows Explain/Summary inline on the card; "Listen" speaks them through
  // the voice overlay. Full Read always opens the article page in Read mode, and
  // reads it aloud through the overlay in Listen mode.
  const [mode, setMode] = useState<Mode>('listen');
  const [openPanel, setOpenPanel] = useState<{ articleId: string; type: PanelType } | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const listParams = { interests: profile?.interests.join(','), limit: 5, language: profile?.language ?? 'en' };
  const { data: recommendations = [], isLoading, isError, refetch } = useListArticles(
    listParams,
    { query: { queryKey: getListArticlesQueryKey(listParams), enabled: !!profile } },
  );

  const openVoiceAssistant = () => {
    window.dispatchEvent(new CustomEvent('shruti:open', { detail: { autoStart: true } }));
  };

  const togglePanel = (article: Article, type: PanelType) => {
    setOpenPanel((prev) =>
      prev?.articleId === article.id && prev.type === type ? null : { articleId: article.id, type },
    );
  };

  // Explain, Summary, and Full Read in listen mode all open the same
  // ListenPlayer surface — only the mode (and therefore the text read aloud)
  // differs — with the currently-visible recommendations as the story list
  // for previous/next navigation.
  const dispatchListen = (article: Article, listenMode: 'explain' | 'summary' | 'full') => {
    window.dispatchEvent(
      new CustomEvent('shruti:listen', { detail: { articles: recommendations, articleId: article.id, mode: listenMode } }),
    );
  };

  const handleExplain = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    if (mode === 'listen') {
      dispatchListen(article, 'explain');
    } else {
      togglePanel(article, 'explain');
    }
  };

  const handleSummary = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    if (mode === 'listen') {
      dispatchListen(article, 'summary');
    } else {
      togglePanel(article, 'summary');
    }
  };

  const handleFullRead = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    if (mode === 'listen') {
      dispatchListen(article, 'full');
    } else {
      setLocation(`/article/${article.id}`);
    }
  };

  const handleSave = (e: React.MouseEvent, article: Article) => {
    e.preventDefault();
    articleService.addToHistory(article);
    setSavedIds((prev) => new Set(prev).add(article.id));
    toast({ description: `Saved "${article.title}" to your history.` });
  };

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <header className="bg-primary text-primary-foreground px-6 py-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ShrutiAvatar className="w-10 h-10 ring-2 ring-primary-foreground/30" />
            <div className="min-w-0">
              <p className="text-primary-foreground/70 font-medium tracking-wide uppercase text-xs">
                Today's Reading · {formatLongDate(new Date())}
              </p>
              <h1 className="text-xl md:text-2xl font-serif leading-snug truncate">
                Good morning{profile.nickname ? `, ${profile.nickname}` : ''}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <UserName className="hidden sm:inline text-sm font-medium text-primary-foreground/90 max-w-[10rem]" />
            <Link href="/history" className="p-2.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition-colors" title="Reading History">
              <HistoryIcon className="w-5 h-5 text-primary-foreground" />
            </Link>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="p-2.5 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition-colors"
              title="Log out"
            >
              <LogOut className="w-5 h-5 text-primary-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 gap-4">
          <p className="text-xl text-muted-foreground">
            {isLoading
              ? 'Fetching today\'s live news for you...'
              : `I found ${recommendations.length} live items relevant to your interests today.`}
          </p>
          <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => refetch()} title="Refresh">
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isError && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-4">I couldn't reach the news feed just now.</p>
            <Button onClick={() => refetch()}>Try again</Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-secondary/40 animate-pulse" />
            ))}
          </div>
        )}

        <div className="space-y-6">
          {recommendations.map((article) => {
            const explainText = getExplainText(article);
            const summaryText = getSummaryText(article);
            const isSaved = savedIds.has(article.id);
            const panel = openPanel?.articleId === article.id ? openPanel.type : null;

            return (
              <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow group relative">
                <Link href={`/article/${article.id}`}>
                  <CardContent className="p-0">
                    <div className="p-6 cursor-pointer">
                      <div className="flex items-center gap-3 mb-3 text-sm font-medium text-muted-foreground">
                        <span className="text-primary bg-primary/5 px-2 py-1 rounded-md">{article.source}</span>
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {article.estimatedReadingTime}</span>
                        {article.originalLanguage !== article.language && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-muted-foreground/80">
                                <Languages className="w-4 h-4" /> Translated from {languageLabel(article.originalLanguage)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Originally published in {languageLabel(article.originalLanguage)}, translated to {languageLabel(article.language)}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <h2 className="text-2xl font-serif text-foreground leading-snug mb-3">
                        {article.title}
                      </h2>
                      <p className="text-lg text-muted-foreground line-clamp-2">
                        {article.summary}
                      </p>

                      <div className="mt-6 flex items-center gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => handleExplain(e, article)}>
                                <Lightbulb className="w-4 h-4 mr-2" /> Explain
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Explanation · 1 sentence · {formatDuration(estimateSeconds(explainText))}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => handleSummary(e, article)}>
                                <FileText className="w-4 h-4 mr-2" /> Summary
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Summary · 3–4 sentences · {formatDuration(estimateSeconds(summaryText))}
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => handleFullRead(e, article)}>
                                <BookOpenText className="w-4 h-4 mr-2" /> Full Read
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {article.fullTextAvailable
                                ? `Full Article · ${article.estimatedReadingTime}`
                                : article.aiExpanded
                                ? `AI-expanded read · ${article.estimatedReadingTime}`
                                : `Preview only · ${article.source} blocks full text`}
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="ml-auto flex items-center gap-1 shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                role="group"
                                className="flex items-center bg-secondary/60 rounded-full p-1"
                                onClick={(e) => e.preventDefault()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); setMode('read'); }}
                                  className={`p-2 rounded-full transition-colors ${mode === 'read' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                                  aria-pressed={mode === 'read'}
                                  title="Read mode"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); setMode('listen'); }}
                                  className={`p-2 rounded-full transition-colors ${mode === 'listen' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'}`}
                                  aria-pressed={mode === 'listen'}
                                  title="Listen mode"
                                >
                                  <Headphones className="w-4 h-4" />
                                </button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {mode === 'read' ? 'Read mode: shows text inline' : 'Listen mode: Shruti reads it aloud'}
                            </TooltipContent>
                          </Tooltip>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full text-muted-foreground shrink-0"
                            onClick={(e) => handleSave(e, article)}
                            title="Save to history"
                          >
                            {isSaved ? <BookmarkCheck className="w-5 h-5 text-primary" /> : <Bookmark className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>

                      {panel && (
                        <div
                          className="mt-4 p-4 rounded-xl bg-secondary/40 border border-border text-foreground text-lg leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200"
                          onClick={(e) => e.preventDefault()}
                        >
                          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
                            {panel === 'explain' ? 'Explanation' : 'Summary'}
                          </p>
                          {panel === 'explain' ? explainText : summaryText}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                        <span className="text-sm font-medium text-primary italic opacity-80 line-clamp-1 pr-4">
                          {article.reason}
                        </span>
                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Floating Mic Button — gated behind FEATURES.voiceInteraction */}
      {FEATURES.voiceInteraction && (
        <div className="fixed right-8 z-40" style={{ bottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))' }}>
          <Button
            size="iconLg"
            onClick={openVoiceAssistant}
            className="shadow-[0_8px_30px_rgba(30,63,32,0.3)] hover:scale-105 transition-transform"
          >
            <Mic className="w-8 h-8" />
          </Button>
        </div>
      )}
    </div>
  );
}
