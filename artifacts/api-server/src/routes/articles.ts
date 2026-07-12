import { Router, type IRouter } from "express";
import {
  ListArticlesQueryParams,
  ListArticlesResponse,
  GetArticleParams,
  GetArticleResponse,
} from "@workspace/api-zod";
import { listRecommendations, getArticleById } from "../lib/newsService";

const router: IRouter = Router();

router.get("/articles", async (req, res): Promise<void> => {
  const parsed = ListArticlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const interests = parsed.data.interests
    ? parsed.data.interests
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const limit = parsed.data.limit ?? 5;
  const language = parsed.data.language ?? "en";

  req.log.info({ interests, limit, language }, "Fetching live article recommendations");
  const recommendations = await listRecommendations(interests, limit, language);
  res.json(ListArticlesResponse.parse(recommendations));
});

router.get("/articles/:id", async (req, res): Promise<void> => {
  const params = GetArticleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const article = getArticleById(params.data.id);
  if (!article) {
    res.status(404).json({
      error: "Article not found or expired from cache. Refresh the dashboard to fetch current articles.",
    });
    return;
  }

  res.json(GetArticleResponse.parse(article));
});

export default router;
