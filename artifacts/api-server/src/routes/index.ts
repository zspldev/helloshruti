import { Router, type IRouter } from "express";
import healthRouter from "./health";
import articlesRouter from "./articles";
import ttsRouter from "./tts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(articlesRouter);
router.use(ttsRouter);

export default router;
