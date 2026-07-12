import type { ContentLanguage } from "../newsService";

export interface SynthesizedAudio {
  /** Raw audio bytes, not yet base64-encoded. */
  audio: Buffer;
  mimeType: string;
}

/**
 * A TTS provider adapter. Implementations own everything provider-specific
 * (auth headers, voice IDs, request shape) so the rest of the app never
 * touches a vendor SDK directly — swapping providers is a config-file edit,
 * not a code change. Every provider must accept plain text up to the caller's
 * `maxCharsPerRequest` limit; longer text is chunked by the dispatcher.
 */
export interface TtsProvider {
  readonly maxCharsPerRequest: number;
  synthesize(text: string, language: ContentLanguage): Promise<SynthesizedAudio>;
}
