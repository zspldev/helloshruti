export type VoiceCommandMatch = 
  | 'READ_BRIEFING'
  | 'READ_ARTICLE'
  | 'SUMMARIZE'
  | 'EXPLAIN'
  | 'NEXT'
  | 'REPEAT'
  | 'SAVE'
  | 'STOP'
  | 'UNKNOWN';

export const voiceService = {
  isSupported: (): boolean => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  },

  speak: (text: string, onEnd?: () => void): void => {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // Try to find a warm, natural female voice if possible
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 0.95; // Slightly slower, calm pacing
    utterance.pitch = 1.0;
    
    if (onEnd) {
      utterance.onend = onEnd;
    }

    window.speechSynthesis.speak(utterance);
  },

  stopSpeaking: (): void => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  listen: (onResult: (text: string) => void, onError: (err: any) => void): void => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError(new Error("Speech recognition not supported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: any) => {
      onError(event.error);
    };

    try {
      recognition.start();
    } catch (e) {
      onError(e);
    }
  },

  matchCommand: (text: string): VoiceCommandMatch => {
    const lower = text.toLowerCase();
    if (lower.includes('briefing') || lower.includes('today')) return 'READ_BRIEFING';
    if (lower.includes('read this') || lower.includes('read article')) return 'READ_ARTICLE';
    if (lower.includes('summarize') || lower.includes('summary')) return 'SUMMARIZE';
    if (lower.includes('explain') || lower.includes('tell me more')) return 'EXPLAIN';
    if (lower.includes('next')) return 'NEXT';
    if (lower.includes('repeat')) return 'REPEAT';
    if (lower.includes('save')) return 'SAVE';
    if (lower.includes('stop') || lower.includes('pause')) return 'STOP';
    
    return 'UNKNOWN';
  }
};