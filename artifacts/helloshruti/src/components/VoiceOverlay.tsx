import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { ConversationMessage, Article } from '@/models/types';
import { voiceService } from '@/services/voiceService';
import { useProfile } from '@/hooks/use-profile';
import { listArticles } from '@workspace/api-client-react';
import { articleService } from '@/services/articleService';
import { X, Mic, Send, MicOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export default function VoiceOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [contextArticle, setContextArticle] = useState<Article | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { getProfile } = useProfile();
  const [, setLocation] = useLocation();

  const isSpeechSupported = voiceService.isSupported();

  useEffect(() => {
    const handleOpen = (e: any) => {
      setIsOpen(true);
      const article = e.detail?.articleContext;
      if (article) setContextArticle(article);

      if (e.detail?.autoStart) {
        // If it was opened with autoStart, Shruti speaks first based on context
        const profile = getProfile();
        const nickname = profile?.nickname || 'there';
        if (e.detail?.command) {
            handleCommand(e.detail.command.toLowerCase());
        } else if (article) {
          addMessage('shruti', `I'm ready to talk about "${article.title}". What would you like to know?`);
          voiceService.speak(`I'm ready to talk about "${article.title}". What would you like to know?`);
        } else {
          addMessage('shruti', `Hello ${nickname}. How can I help you today?`);
          voiceService.speak(`Hello ${nickname}. How can I help you today?`);
        }
      }
    };

    const handleListenArticle = (e: any) => {
      setIsOpen(true);
      const article = e.detail?.article;
      if (article) {
        setContextArticle(article);
        const text = `${article.title}. ${article.content}`;
        addMessage('shruti', `Reading: ${article.title}...`);
        voiceService.speak(text);
      }
    };

    window.addEventListener('shruti:open', handleOpen);
    window.addEventListener('shruti:listen_article', handleListenArticle);

    return () => {
      window.removeEventListener('shruti:open', handleOpen);
      window.removeEventListener('shruti:listen_article', handleListenArticle);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (sender: 'shruti' | 'user', text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: Date.now()
    }]);
  };

  const handleCommand = async (text: string) => {
    addMessage('user', text);
    const command = voiceService.matchCommand(text);
    const profile = getProfile();
    const nickname = profile?.nickname || 'there';

    if (command === 'READ_BRIEFING') {
      try {
        const recs = await listArticles({ interests: profile?.interests.join(','), limit: 5 });
        let response: string;
        if (recs.length > 0) {
          const first = recs[0];
          setContextArticle(first);
          response = `Good morning, ${nickname}. I found ${recs.length} live items relevant to your interests. The first is about ${first.title}. ${first.summary}. Would you like me to read the full article or go to the next one?`;
        } else {
          response = `Good morning, ${nickname}. I couldn't find any new items matching your interests right now.`;
        }
        addMessage('shruti', response);
        voiceService.speak(response);
      } catch {
        const response = `Sorry ${nickname}, I couldn't reach the live news feed just now. Please try again in a moment.`;
        addMessage('shruti', response);
        voiceService.speak(response);
      }
      return;
    }

    setTimeout(() => {
      let response = '';

      switch (command) {
        case 'READ_ARTICLE':
          if (contextArticle) {
            response = `Reading ${contextArticle.title}. ${contextArticle.content}`;
          } else {
            response = "I don't have a specific article open right now. Would you like me to read your briefing?";
          }
          break;
        case 'SUMMARIZE':
          if (contextArticle) {
            response = `Here is a summary of ${contextArticle.title}: ${contextArticle.summary}`;
          } else {
            response = "I don't have a specific article open right now to summarize.";
          }
          break;
        case 'EXPLAIN':
          if (contextArticle) {
            response = `Certainly, ${nickname}. This article discusses ${contextArticle.title}. In simple terms, it means that ${contextArticle.summary} It is highly relevant to your interest in ${contextArticle.topics[0]}.`;
          } else {
            response = "I need an article context to explain further.";
          }
          break;
        case 'NEXT':
          response = "Moving to the next article."; // In a full app, this would advance a queue
          break;
        case 'REPEAT':
          response = "Let me repeat that."; // In a full app, this would repeat the last Shruti message
          break;
        case 'SAVE':
          if (contextArticle) {
            articleService.addToHistory(contextArticle);
            response = `I've saved "${contextArticle.title}" to your history.`;
          } else {
            response = "There's no article currently open to save.";
          }
          break;
        case 'STOP':
          voiceService.stopSpeaking();
          response = "Stopping.";
          break;
        case 'UNKNOWN':
        default:
          response = `I'm not sure how to help with that, ${nickname}. You can ask me to read your briefing, summarize the current article, or explain it in more detail.`;
          break;
      }

      addMessage('shruti', response);
      if (command !== 'STOP') {
        voiceService.speak(response);
      }
    }, 500);
  };

  const startListening = () => {
    setIsListening(true);
    voiceService.stopSpeaking();
    voiceService.listen(
      (text) => {
        setIsListening(false);
        handleCommand(text);
      },
      (err) => {
        setIsListening(false);
        console.error("Speech error", err);
      }
    );
  };

  const stopListening = () => {
    setIsListening(false);
    voiceService.stopSpeaking();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleCommand(inputText.trim());
    setInputText('');
  };

  const closeOverlay = () => {
    setIsOpen(false);
    voiceService.stopSpeaking();
    setIsListening(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in zoom-in duration-300">
      <header className="px-6 py-6 flex justify-between items-center border-b border-border bg-background">
        <h2 className="text-2xl font-serif text-primary">Conversation with Shruti</h2>
        <Button variant="ghost" size="icon" onClick={closeOverlay} className="rounded-full w-12 h-12">
          <X className="w-6 h-6" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Mic className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-serif text-primary mb-2">I'm listening...</p>
            <p className="text-muted-foreground">Try saying "Read today's briefing"</p>
          </div>
        )}
        
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="text-sm text-muted-foreground mb-1 px-1">
              {msg.sender === 'user' ? 'You' : 'Shruti'}
            </span>
            <div className={`px-5 py-4 rounded-2xl max-w-[85%] text-lg ${
              msg.sender === 'user' 
                ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                : 'bg-white border border-border text-foreground shadow-sm rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-6 bg-white border-t border-border shadow-[0_-10px_40px_rgba(30,63,32,0.05)]">
        {isSpeechSupported ? (
          <div className="flex flex-col items-center justify-center">
            {isListening ? (
              <Button 
                onClick={stopListening} 
                size="iconLg" 
                variant="destructive"
                className="animate-pulse shadow-lg ring-4 ring-destructive/20"
              >
                <MicOff className="w-8 h-8" />
              </Button>
            ) : (
              <Button 
                onClick={startListening} 
                size="iconLg"
                className="shadow-lg hover:scale-105 transition-transform"
              >
                <Mic className="w-8 h-8" />
              </Button>
            )}
            <p className="text-sm font-medium mt-4 text-muted-foreground">
              {isListening ? "Listening... tap to stop" : "Tap to speak"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="flex gap-3">
            <Input 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Type your command..."
              className="flex-1 bg-secondary/30"
            />
            <Button type="submit" size="icon" className="w-16 shrink-0 rounded-xl">
              <Send className="w-6 h-6" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}