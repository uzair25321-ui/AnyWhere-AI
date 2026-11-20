const TABLE = "feedback";
const ABUSE_TABLE = "feedback_abuse";
const CATEGORIES = new Set(["bug", "idea", "praise", "other"]);
const ALLOWED_ORIGIN = "https://anywhere-ai-site.vercel.app";
const WORD_LIMIT = 200;
const MAX_MESSAGE_CHARS = 4000;

function text(value, limit) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, limit);
}

function wordCount(value) {
  return String(value == null ? "" : value).trim().split(/\s+/).filter(Boolean).length;
}

const LEET = {
  0: "o",
  1: "i",
  3: "e",
  4: "a",
  5: "s",
  6: "g",
  7: "t",
  8: "b",
  9: "g",
  "@": "a",
  $: "s",
  "!": "i"
};

const ABUSIVE_WORDS = [
  "phudi", "phuddi", "fudi", "fuddi", "pudi", "puddi",
  "chut", "choot", "chutia", "chutiya", "chutya", "chutiye",
  "land", "landa", "loda", "lodda", "lodu", "londa", "londay", "lund", "lnd", "lauda",
  "londabaz", "landbaz",
  "kangar", "kanjar", "kangri", "kanjri", "gasti", "gashti", "gasht",
  "randi", "rand", "rndi",
  "bhanchod", "bhenchod", "bhnchod", "bhanchood", "bhenchood", "bhenchd",
  "madarchod", "madrchod", "maderchod", "machod",
  "chod", "chodu", "choda", "chodna", "chudai", "chud",
  "harami", "haramkhor", "haramzada", "haramzadi",
  "gandu", "gaandu", "gand", "gaand",
  "kutta", "kutay", "kuti", "kutiya", "kuttay", "kutte",
  "bhosdi", "bhosda", "bhosdike", "bhonsdi",
  "bc", "mc",
  "fuck", "fucked", "fucking", "fucker", "motherfucker",
  "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "whore", "slut"
];

function normalizeWord(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[013456789@$!]/g, (ch) => LEET[ch] || ch)
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/(.)\1+/g, "$1"))
    .join(" ");
}

const ABUSIVE_SET = new Set(ABUSIVE_WORDS.map(normalizeWord).filter(Boolean));

function findAbuse(value) {
  const tokens = normalizeWord(value).split(" ").filter(Boolean);
  for (const token of tokens) {
    if (ABUSIVE_SET.has(token)) return token;
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const pair = tokens[index] + tokens[index + 1];
    if (ABUSIVE_SET.has(pair)) return pair;
  }
  const compact = tokens.join("");
  for (const word of ABUSIVE_SET) {
    if (word.length >= 7 && compact.includes(word)) return word;
  }
  return null;
}

function clientIp(request) {
  const headers = request.headers || {};
  const forwarded = String(headers["x-forwarded-for"] || "").split(",")[0].trim();
  const real = String(headers["x-real-ip"] || "").trim();
  const socket = request.socket && request.socket.remoteAddress ? String(request.socket.remoteAddress) : "";
  return (forwarded || real || socket || "unknown").replace(/[^0-9a-fA-F:.]/g, "").slice(0, 64) || "unknown";
}

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  ).trim();
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url) || key.length < 20) return null;
  return { url, key };
}

function supabaseHeaders(key) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  // Legacy anon keys are JWTs; new publishable keys must not go in Authorization.
  if (/^eyJ[A-Za-z0-9_-]+\./.test(key)) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function logAbuse(config, entry) {
  if (!config) return;
  try {
    await fetch(`${config.url}/rest/v1/${ABUSE_TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(config.key), Prefer: "return=minimal" },
      body: JSON.stringify([entry]),
      signal: AbortSignal.timeout(8000)
    });
  } catch {
    /* Blocking the feedback matters more than the audit row. */
  }
}

function cors(response) {
  response.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  cors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    response.status(405).json({ error: "Use POST to send feedback." });
    return;
  }

  let body = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      response.status(400).json({ error: "The feedback could not be read." });
      return;
    }
  }
  if (!body || typeof body !== "object") {
    response.status(400).json({ error: "The feedback could not be read." });
    return;
  }

  const name = text(body.name, 80);
  const email = text(body.email, 160);
  const category = text(body.category, 20);
  const rawMessage = String(body.message == null ? "" : body.message).trim();
  const rating = body.rating == null || body.rating === "" ? null : Number(body.rating);
  const source = body.source === "app" ? "app" : "website";
  const appVersion = text(body.app_version, 24) || null;
  const pageUrl = text(body.page_url, 500) || null;

  if (name.length < 2) {
    response.status(400).json({ error: "Enter your name (at least 2 characters)." });
    return;
  }
  if (!CATEGORIES.has(category)) {
    response.status(400).json({ error: "Choose a feedback type first." });
    return;
  }
  if (rawMessage.length < 3) {
    response.status(400).json({ error: "Write a short message so we know what to look at." });
    return;
  }
  if (wordCount(rawMessage) > WORD_LIMIT) {
    response.status(400).json({ error: `Please keep the message under ${WORD_LIMIT} words.` });
    return;
  }
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    response.status(400).json({ error: "Choose a rating between 1 and 5." });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    response.status(400).json({ error: "That email looks incomplete." });
    return;
  }

  const message = rawMessage.slice(0, MAX_MESSAGE_CHARS);
  const config = supabaseConfig();

  const nameAbuse = findAbuse(name);
  const messageAbuse = nameAbuse ? null : findAbuse(message);
  if (nameAbuse || messageAbuse) {
    const word = nameAbuse || messageAbuse;
    await logAbuse(config, {
      ip: clientIp(request),
      reason: `${nameAbuse ? "name" : "message"}: ${word}`,
      word: word.slice(0, 80),
      field: nameAbuse ? "name" : "message",
      message: message.slice(0, 500),
      source,
      user_agent: String((request.headers && request.headers["user-agent"]) || "").slice(0, 300),
      page_url: pageUrl
    });
    response.status(422).json({
      error: "You used abusive language. Your IP address was captured.",
      blocked: true
    });
    return;
  }

  if (!config) {
    response.status(503).json({ error: "Feedback is not connected yet. Please try again later." });
    return;
  }

  try {
    const upstream = await fetch(`${config.url}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: { ...supabaseHeaders(config.key), Prefer: "return=minimal" },
      body: JSON.stringify([
        {
          name,
          email: email || null,
          category,
          rating,
          message,
          show_public: body.show_public !== false,
          app_version: appVersion,
          source,
          page_url: pageUrl
        }
      ]),
      signal: AbortSignal.timeout(10000)
    });

    if (!upstream.ok) {
      response.status(502).json({ error: "Feedback could not be saved right now. Please try again later." });
      return;
    }

    response.status(201).json({ ok: true });
  } catch {
    response.status(502).json({ error: "Feedback could not be saved right now. Please try again later." });
  }
};
