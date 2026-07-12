import { Router, type IRouter } from "express";
import { SynthesizeSpeechBody, SynthesizeSpeechResponse } from "@workspace/api-zod";
import { synthesizeSpeech } from "../lib/tts";

const router: IRouter = Router();

router.post("/tts", async (req, res): Promise<void> => {
  const parsed = SynthesizeSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await synthesizeSpeech(parsed.data.text, parsed.data.language);
    res.json(SynthesizeSpeechResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "TTS synthesis failed");
    res.status(502).json({ error: "Speech synthesis failed" });
  }
});

export default router;
