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

// Timeout id for the in-flight speak() call's safety-net fallback (see
// BACKEND_TTS_TIMEOUT_MS below) — tracked at module scope so stopSpeaking()
// can cancel it. Without this, stopping playback early (user hits Stop,
// navigates away, or starts a new speak()) wouldn't prevent the old timeout
// from firing later and unexpectedly kicking off the browser TTS fallback.
let pendingFallbackTimeoutId: number | null = null;

// A single silent WAV frame, used to "activate" an <audio> element inside the
// same synchronous call stack as the user's tap/click. Mobile browsers (most
// strictly iOS Safari, including installed PWAs) only allow a *specific*
// media element to play without a fresh gesture if that element already had
// a successful play() call started directly from a gesture. Our real audio
// only exists after an uncached, multi-second backend TTS fetch, so calling
// `.play()` for the first time inside that fetch's `.then()` happens outside
// the gesture window — some browsers then silently produce no sound (looked
// like "it's playing" with nothing audible), others reject play() outright
// (which used to leave the player stuck on "Loading" forever). Playing this
// placeholder immediately, then swapping its `src` once real audio arrives,
// keeps the same element "activated" so the later play() is honored.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

// Safety net so a slow/hung backend TTS call (or a browser that never fires
// audio/speechSynthesis start events) can't leave the UI stuck on "Loading"
// indefinitely — after this many ms with no playback started, force the
// browser speechSynthesis fallback.
const BACKEND_TTS_TIMEOUT_MS = 12000;

function speakWithBrowserTts(text: string, language: LanguageCode, onEnd?: () => void, onStart?: () => void): void {
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
  if (onStart) {
    utterance.onstart = onStart;
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
  //
  // The backend call is not cached and can take several seconds (observed
  // 8-9s) for longer text, so `onStart` fires only once audio is actually
  // playing — callers use it to stop showing a "buffering" state, since
  // without it the UI can look like it's already playing while it's really
  // still silently fetching, which reads as "no sound at all" to the user.
  speak: (text: string, language: LanguageCode = 'en', onEnd?: () => void, onStart?: () => void): void => {
    voiceService.stopSpeaking();

    let settled = false; // guards against the timeout and the real response both firing
    const fallbackToBrowser = () => {
      if (settled) return;
      settled = true;
      pendingFallbackTimeoutId = null;
      if (currentAudio) {
        currentAudio.onended = null;
        currentAudio.onerror = null;
        currentAudio = null;
      }
      speakWithBrowserTts(text, language, onEnd, onStart);
    };
    const timeoutId = window.setTimeout(fallbackToBrowser, BACKEND_TTS_TIMEOUT_MS);
    pendingFallbackTimeoutId = timeoutId;

    // Start on a silent placeholder immediately, inside the caller's user
    // gesture, so this exact <audio> element is "activated" before the real
    // audio is ready — see SILENT_WAV comment above.
    const audio = new Audio(SILENT_WAV);
    currentAudio = audio;
    audio.play().catch(() => {
      /* best-effort unlock; some browsers reject a source-less/near-empty
         clip, which is fine — we still try the real audio once it arrives */
    });

    synthesizeSpeechApi({ text, language })
      .then(({ audioBase64, mimeType }) => {
        if (settled || currentAudio !== audio) return; // superseded by stop/timeout/newer speak() call
        audio.pause();
        audio.src = `data:${mimeType};base64,${audioBase64}`;
        audio.currentTime = 0;
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          if (onEnd) onEnd();
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          fallbackToBrowser();
        };
        audio
          .play()
          .then(() => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            pendingFallbackTimeoutId = null;
            onStart?.();
          })
          .catch(() => {
            if (currentAudio === audio) currentAudio = null;
            fallbackToBrowser();
          });
      })
      .catch(() => {
        if (currentAudio === audio) currentAudio = null;
        fallbackToBrowser();
      });
  },

  stopSpeaking: (): void => {
    if (pendingFallbackTimeoutId !== null) {
      window.clearTimeout(pendingFallbackTimeoutId);
      pendingFallbackTimeoutId = null;
    }
    if (currentAudio) {
      currentAudio.onended = null;
      currentAudio.onerror = null;
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
