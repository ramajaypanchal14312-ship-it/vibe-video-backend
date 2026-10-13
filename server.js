const express = require("express");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.YOUTUBE_API_KEY;

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "VIBE Video Search" });
});

app.get("/api/videos", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({
      error: "YouTube API is not configured on the server."
    });
  }

  const query = String(req.query.q || "").trim();

  if (query.length < 1 || query.length > 100) {
    return res.status(400).json({
      error: "Search text must be between 1 and 100 characters."
    });
  }

  try {
    const url = new URL(
      "https://www.googleapis.com/youtube/v3/search"
    );

    url.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      videoEmbeddable: "true",
      maxResults: "10",
      q: query,
      key: API_KEY
    }).toString();

    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("YouTube API error:", response.status);
      return res.status(502).json({
        error: "YouTube search failed. Check server API configuration."
      });
    }

    const videos = (data.items || [])
      .filter(item => item.id && item.id.videoId && item.snippet)
      .map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url ||
          "",
        url: "https://www.youtube.com/watch?v=" + item.id.videoId
      }));

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ videos });
  } catch (error) {
    console.error("Video search request failed:", error.message);
    res.status(502).json({ error: "Could not reach YouTube." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("VIBE Video Search server listening on port " + PORT);
});
