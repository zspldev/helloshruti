import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { articleService } from '@/services/articleService';
import { Article } from '@/models/types';
import { ArrowLeft, Clock, Headphones, MessageSquare, Play } from 'lucide-react';

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    if (id) {
      const found = articleService.getArticleById(id);
      if (found) {
        setArticle(found);
        articleService.addToHistory(id);
      }
    }
  }, [id]);

  if (!article) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <p className="text-xl">Article not found.</p>
      </div>
    );
  }

  // Trigger global voice overlay with a specific command payload
  const handleTalk = () => {
    window.dispatchEvent(new CustomEvent('shruti:open', { 
      detail: { articleContext: article, autoStart: true } 
    }));
  };

  const handleListen = () => {
    window.dispatchEvent(new CustomEvent('shruti:listen_article', { 
      detail: { article } 
    }));
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-32">
      <header className="px-6 py-6 border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/')} className="shrink-0 rounded-full h-12 w-12 hover:bg-secondary">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary uppercase tracking-wide truncate">{article.source}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex flex-wrap gap-2 mb-6">
          {article.topics.map(t => (
            <span key={t} className="px-3 py-1 bg-secondary text-secondary-foreground text-sm font-medium rounded-full">
              {t}
            </span>
          ))}
        </div>

        <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight mb-6">
          {article.title}
        </h1>

        <div className="flex items-center gap-6 text-muted-foreground font-medium mb-10 pb-10 border-b border-border">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {article.estimatedReadingTime}
          </span>
          <span>{new Date(article.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="prose prose-lg md:prose-xl max-w-none text-foreground prose-headings:font-serif prose-headings:text-primary">
          <p className="lead text-2xl font-serif text-primary/90 mb-8 leading-relaxed">
            {article.summary}
          </p>
          
          <div className="space-y-6 text-xl leading-relaxed">
            {article.content.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      </main>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-border p-4 md:p-6 shadow-[0_-10px_40px_rgba(30,63,32,0.05)] z-20">
        <div className="max-w-3xl mx-auto flex gap-4">
          <Button 
            className="flex-1 gap-3 h-16 text-lg rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/80" 
            onClick={handleListen}
          >
            <Play className="w-6 h-6" /> Listen
          </Button>
          <Button 
            className="flex-1 gap-3 h-16 text-lg rounded-2xl shadow-md" 
            onClick={handleTalk}
          >
            <MessageSquare className="w-6 h-6" /> Talk about this
          </Button>
        </div>
      </div>
    </div>
  );
}