import { synthesizeSpeech as synthesizeSpeechApi } from '@workspace/api-client-react';
import { LanguageCode } from '@/models/types';

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

// BCP-47 tags for the browser speechSynthesis fallback (used when the backend
// TTS provider is unavailable). Separate from the backend's own language-code
// mapping (artifacts/api-server/src/config/ttsProvider.json).
const BROWSER_SPEECH_LANG: Record<LanguageCode, string> = {
  en: 'en-IN',
  mr: 'mr-IN',
  hi: 'hi-IN',
};

// Tracks whichever playback mechanism is currently active so pause/resume/stop
// can address the right one — narration may be playing through the backend
// TTS provider's audio file, or through the browser's speechSynthesis fallback.
let currentAudio: HTMLAudioElement | null = null;

function speakWithBrowserTts(text: string, language: LanguageCode, onEnd?: () => void): void {
  if (!('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BROWSER_SPEECH_LANG[language];

  // Try to find a warm, natural female voice if possible, ideally matching the language.
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang?.toLowerCase().startsWith(language) && /female/i.test(v.name)) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(language)) ??
    voices.find((v) => v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Google UK English Female'));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  utterance.rate = 0.95; // Slightly slower, calm pacing
  utterance.pitch = 1.0;

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

export const voiceService = {
  isSupported: (): boolean => {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  },

  // Narrates `text` in `language`. Tries the backend TTS provider (real,
  // human-like Indic-language voices) first; if that request fails for any
  // reason (network, provider outage, misconfigured key) it falls back to the
  // browser's built-in speechSynthesis so narration never silently breaks.
  speak: (text: string, language: LanguageCode = 'en', onEnd?: () => void): void => {
    voiceService.stopSpeaking();

    synthesizeSpeechApi({ text, language })
      .then(({ audioBase64, mimeType }) => {
        const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
        currentAudio = audio;
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          if (onEnd) onEnd();
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          speakWithBrowserTts(text, language, onEnd);
        };
        audio.play().catch(() => {
          currentAudio = null;
          speakWithBrowserTts(text, language, onEnd);
        });
      })
      .catch(() => {
        speakWithBrowserTts(text, language, onEnd);
      });
  },

  stopSpeaking: (): void => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  pauseSpeaking: (): void => {
    if (currentAudio) {
      currentAudio.pause();
      return;
    }
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  },

  resumeSpeaking: (): void => {
    if (currentAudio) {
      currentAudio.play().catch(() => {});
      return;
    }
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
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
