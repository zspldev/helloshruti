import type { ContentLanguage } from "../newsService";
import type { SynthesizedAudio, TtsProvider } from "./types";
import { logger } from "../logger";

interface SarvamProviderConfig {
  apiKeyEnv: string;
  baseUrl: string;
  model: string;
  speaker: string;
  sampleRate: number;
  languageCodes: Record<ContentLanguage, string>;
}

interface SarvamResponseBody {
  audios?: string[];
}

// Sarvam's Bulbul models cap input at 2500 characters per request. Leave
// headroom below that so we never trip the limit on a boundary case.
const SARVAM_MAX_CHARS = 2200;

export function createSarvamProvider(config: SarvamProviderConfig): TtsProvider {
  return {
    maxCharsPerRequest: SARVAM_MAX_CHARS,
    async synthesize(text: string, language: ContentLanguage): Promise<SynthesizedAudio> {
      const apiKey = process.env[config.apiKeyEnv];
      if (!apiKey) {
        throw new Error(`Missing ${config.apiKeyEnv} environment variable for Sarvam TTS`);
      }

      const targetLanguageCode = config.languageCodes[language];
      const response = await fetch(`${config.baseUrl}/text-to-speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify({
          text,
          target_language_code: targetLanguageCode,
          model: config.model,
          speaker: config.speaker,
          speech_sample_rate: config.sampleRate,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        logger.error(
          { status: response.status, body: errorBody.slice(0, 500) },
          "Sarvam TTS request failed",
        );
        throw new Error(`Sarvam TTS request failed with status ${response.status}`);
      }

      const body = (await response.json()) as SarvamResponseBody;
      const audioBase64 = body.audios?.[0];
      if (!audioBase64) {
        throw new Error("Sarvam TTS response did not include audio");
      }

      return {
        audio: Buffer.from(audioBase64, "base64"),
        mimeType: "audio/wav",
      };
    },
  };
}
