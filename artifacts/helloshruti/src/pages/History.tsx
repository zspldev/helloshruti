import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { articleService } from '@/services/articleService';
import { HistoryEntry } from '@/models/types';
import { ArrowLeft, Calendar, FileText, ChevronRight, Edit2 } from 'lucide-react';
import { Link } from 'wouter';
import { Input } from '@/components/ui/input';
import ShrutiAvatar from '@/components/ShrutiAvatar';
import UserName from '@/components/UserName';

export default function History() {
  const [, setLocation] = useLocation();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    setHistory(articleService.getHistory());
  }, []);

  const handleSaveNote = (articleId: string) => {
    articleService.saveNote(articleId, noteText);
    setHistory(articleService.getHistory());
    setEditingNoteId(null);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="px-6 py-6 border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/dashboard')} className="shrink-0 rounded-full h-12 w-12 hover:bg-secondary">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <ShrutiAvatar className="w-9 h-9" />
          <h1 className="text-2xl font-serif text-primary flex-1 truncate">Things I've Read</h1>
          <UserName className="hidden sm:inline text-sm font-medium text-muted-foreground max-w-[10rem] shrink-0" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {history.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-secondary/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-serif text-foreground mb-3">No reading history yet</h2>
            <p className="text-lg text-muted-foreground mb-8">Items you read will appear here.</p>
            <Button onClick={() => setLocation('/dashboard')} size="lg">Read Today's Briefing</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((entry) => (
              <Card key={`${entry.articleId}-${entry.dateRead}`} className="overflow-hidden hover:shadow-md transition-shadow">
                <Link href={`/article/${entry.articleId}`}>
                  <CardContent className="p-6 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3 text-sm font-medium text-muted-foreground">
                      <span className="flex items-center gap-1 text-primary"><Calendar className="w-4 h-4"/> {new Date(entry.dateRead).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                      <span>•</span>
                      <span>{entry.article.source}</span>
                    </div>
                    <h2 className="text-xl font-serif text-foreground leading-snug mb-3 pr-8 relative">
                      {entry.article.title}
                      <ChevronRight className="w-5 h-5 text-muted-foreground absolute right-0 top-1/2 -translate-y-1/2" />
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {entry.article.topics.slice(0, 3).map(t => (
                        <span key={t} className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-medium rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Link>
                <div className="px-6 pb-6 pt-0 border-t border-border mt-2">
                  {editingNoteId === entry.articleId ? (
                    <div className="flex gap-2 mt-4">
                      <Input 
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        className="h-10 text-base"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleSaveNote(entry.articleId)}>Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between text-muted-foreground group/note cursor-pointer" onClick={() => { setEditingNoteId(entry.articleId); setNoteText(entry.userNote || ''); }}>
                      <p className="text-base italic flex-1">{entry.userNote || "Click to add a personal note..."}</p>
                      <Edit2 className="w-4 h-4 ml-2 opacity-50 group-hover/note:opacity-100" />
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}