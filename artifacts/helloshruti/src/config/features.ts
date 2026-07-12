// Top-level feature switches for the whole app. Flip a value here to turn a
// feature on or off everywhere it's used — do not scatter ad-hoc checks
// elsewhere. Code behind a disabled flag is kept in place (not deleted) so it
// can be re-enabled later without rebuilding it.
export const FEATURES = {
  // Conversational voice assistant: the floating microphone button, the
  // "Talk about this" action, and voice-command recognition (VoiceOverlay +
  // voiceService.listen/matchCommand). Off for now.
  //
  // Note: this does NOT cover Listen Mode (Explain/Summary/Full Read via
  // ListenPlayer) — that's text-to-speech playback, not voice interaction,
  // and stays on regardless of this flag.
  voiceInteraction: false,
} as const;
