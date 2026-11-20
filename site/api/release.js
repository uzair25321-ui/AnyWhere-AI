const REPO = "uzair25321-ui/AnyWhere-AI";

module.exports = async (request, response) => {
  try {
    const upstream = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Anywhere-AI-Site" }
    });
    const reset = upstream.headers.get("x-ratelimit-reset");

    if (upstream.status === 403 || upstream.status === 429) {
      if (reset) response.setHeader("x-ratelimit-reset", reset);
      response.setHeader("Cache-Control", "no-store");
      response.status(429).json({ error: "GitHub request limit reached." });
      return;
    }

    if (!upstream.ok) {
      response.setHeader("Cache-Control", "no-store");
      response.status(502).json({ error: "GitHub is unavailable." });
      return;
    }

    const release = await upstream.json();
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    response.status(200).json(release);
  } catch {
    response.setHeader("Cache-Control", "no-store");
    response.status(502).json({ error: "GitHub is unreachable." });
  }
};
