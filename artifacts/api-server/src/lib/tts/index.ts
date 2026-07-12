import ttsProviderConfig from "../../config/ttsProvider.json";
import type { ContentLanguage } from "../newsService";
import type { TtsProvider } from "./types";
import { createSarvamProvider } from "./sarvamProvider";
import { concatWavBuffers } from "./wav";

interface TtsProviderConfigFile {
  provider: string;
  providers: Record<string, Record<string, unknown>>;
}

const config = ttsProviderConfig as TtsProviderConfigFile;

// Provider adapters are registered here by name; the active one is picked at
// runtime from config/ttsProvider.json's top-level "provider" field. Adding a
// new vendor means writing an adapter + registering it here, then flipping
// the JSON — never touching the route or the rest of the app.
const PROVIDER_FACTORIES: Record<string, (settings: Record<string, unknown>) => TtsProvider> = {
  sarvam: (settings) => createSarvamProvider(settings as any),
};

function loadProvider(): TtsProvider {
  const factory = PROVIDER_FACTORIES[config.provider];
  if (!factory) {
    throw new Error(`Unknown TTS provider "${config.provider}" in ttsProvider.json`);
  }
  const settings = config.providers[config.provider];
  if (!settings) {
    throw new Error(`No settings found for TTS provider "${config.provider}" in ttsProvider.json`);
  }
  return factory(settings);
}

let cachedProvider: TtsProvider | null = null;
function getProvider(): TtsProvider {
  if (!cachedProvider) {
    cachedProvider = loadProvider();
  }
  return cachedProvider;
}

/**
 * Splits text into chunks no longer than maxChars, preferring sentence
 * boundaries so a request never gets cut off mid-word (which would produce
 * an audible glitch once chunks are stitched back together).
 */
function chunkText(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return [normalized];

  const sentences = normalized.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > maxChars) {
      chunks.push(current.trim());
      current = "";
    }
    // A single sentence longer than the limit still needs a hard split.
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars).trim());
      }
      continue;
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current.trim());

  return chunks.filter(Boolean);
}

export interface SpeechResult {
  audioBase64: string;
  mimeType: string;
}

export async function synthesizeSpeech(text: string, language: ContentLanguage): Promise<SpeechResult> {
  const provider = getProvider();
  const chunks = chunkText(text, provider.maxCharsPerRequest);

  // Provider rate limits favor sequential requests over a burst of parallel ones.
  const results = [];
  for (const chunk of chunks) {
    results.push(await provider.synthesize(chunk, language));
  }

  const mimeType = results[0].mimeType;
  const combined =
    mimeType === "audio/wav"
      ? concatWavBuffers(results.map((r) => r.audio))
      : Buffer.concat(results.map((r) => r.audio));

  return {
    audioBase64: combined.toString("base64"),
    mimeType,
  };
}
