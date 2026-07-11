import { useListArticles, getListArticlesQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useClerk } from '@clerk/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/hooks/use-profile';
import { Clock, Bookmark, ChevronRight, History as HistoryIcon, Mic, RefreshCw, LogOut } from 'lucide-react';
import { articleService } from '@/services/articleService';

export default function Dashboard() {
  const { getProfile } = useProfile();
  const profile = getProfile();
  const { signOut } = useClerk();

  const listParams = { interests: profile?.interests.join(','), limit: 5 };
  const { data: recommendations = [], isLoading, isError, refetch } = useListArticles(
    listParams,
    { query: { queryKey: getListArticlesQueryKey(listParams), enabled: !!profile } },
  );

  const openVoiceAssistant = () => {
    window.dispatchEvent(new CustomEvent('shruti:open', { detail: { autoStart: true } }));
  };

  if (!profile) return null;

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <header className="bg-primary text-primary-foreground px-6 py-8 md:py-12 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex justify-between items-end">
          <div>
            <p className="text-primary-foreground/80 font-medium mb-1 tracking-wide uppercase text-sm">Today's Reading</p>
            <h1 className="text-3xl md:text-5xl font-serif leading-tight">
              Good morning, <br />{profile.nickname}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/history" className="p-3 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition-colors" title="Reading History">
              <HistoryIcon className="w-6 h-6 text-primary-foreground" />
            </Link>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              className="p-3 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full transition-colors"
              title="Log out"
            >
              <LogOut className="w-6 h-6 text-primary-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
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
          {recommendations.map((article) => (
            <Card key={article.id} className="overflow-hidden hover:shadow-md transition-shadow group relative">
              <Link href={`/article/${article.id}`}>
                <CardContent className="p-0">
                  {article.imageUrl && (
                    <img src={article.imageUrl} alt="" className="w-full h-40 object-cover" />
                  )}
                  <div className="p-6 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3 text-sm font-medium text-muted-foreground">
                      <span className="text-primary bg-primary/5 px-2 py-1 rounded-md">{article.source}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4"/> {article.estimatedReadingTime}</span>
                    </div>
                    <h2 className="text-2xl font-serif text-foreground leading-snug mb-3">
                      {article.title}
                    </h2>
                    <p className="text-lg text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                    
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" className="rounded-full" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('shruti:listen_article', { detail: { article } })); }}>
                        Listen
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('shruti:open', { detail: { articleContext: article, autoStart: true, command: 'SUMMARIZE' } })); }}>
                        Summary
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent('shruti:open', { detail: { articleContext: article, autoStart: true, command: 'EXPLAIN' } })); }}>
                        Explain
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-full ml-auto text-muted-foreground" onClick={(e) => { e.preventDefault(); articleService.addToHistory(article); window.dispatchEvent(new CustomEvent('shruti:open', { detail: { articleContext: article, autoStart: true, command: 'SAVE' } })); }}>
                        <Bookmark className="w-4 h-4 mr-2" /> Save
                      </Button>
                    </div>

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
          ))}
        </div>
      </main>

      {/* Floating Mic Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <Button 
          size="iconLg" 
          onClick={openVoiceAssistant}
          className="shadow-[0_8px_30px_rgba(30,63,32,0.3)] hover:scale-105 transition-transform"
        >
          <Mic className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
}