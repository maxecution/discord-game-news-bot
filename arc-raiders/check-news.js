import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { load } from 'cheerio';

const BASE_URL = 'https://arcraiders.com';
const NEWS_URL = BASE_URL + '/news';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'state.json');

const WEBHOOK = process.env.DISCORD_ARCRAIDERS_WEBHOOK;

if (!WEBHOOK) {
  throw new Error('DISCORD_ARCRAIDERS_WEBHOOK is not set');
}

/* ---------------- State ---------------- */

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    const lastPublished = raw.last_published ? new Date(raw.last_published) : null;

    if (!lastPublished || isNaN(lastPublished)) return null;

    return {
      lastPublished,
      postedUrls: Array.isArray(raw.posted_urls) ? raw.posted_urls : [],
    };
  } catch {
    return null;
  }
}

function saveState(date, postedUrls) {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        last_published: date.toISOString(),
        posted_urls: postedUrls,
      },
      null,
      2,
    ),
  );
}

/* ---------------- Scrape ---------------- */

// Arc Raiders only exposes a date (no time), so parsing it as UTC midnight for consistency with Nightreign format
function parseDate(text) {
  // "January 13, 2026" → Date at 00:00:00 UTC
  const date = new Date(`${text} UTC`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${text}`);
  }
  return date;
}

async function fetchWithRetry(url, options, maxAttempts = 3) {
  let res = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, options);

      if (res.ok) return res;

      console.warn(`Fetch attempt ${attempt} blocked: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`Fetch attempt ${attempt} failed `, err.message);
    }

    if (attempt < maxAttempts) {
      const delay = 2000 * attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return null;
}

async function getLatestNewsArticles() {
  const res = await fetchWithRetry(
    NEWS_URL,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
    3,
  );

  if (!res) {
    console.warn('Arc Raiders fetch abandoned after retries');
    return [];
  }

  const html = await res.text();
  const $ = load(html);

  const section = $('div[class^="news-article-grid_newsArticleGrid"]');
  if (!section.length) throw new Error('News section not found');

  const articles = [];

  section.find('a[class^="news-article-card_container"]').each((_, el) => {
    const card = $(el);
    const title = card.find('div[class^="news-article-card_title"]').text().trim();
    const href = card.attr('href');
    if (!href) return;
    const url = new URL(href, BASE_URL).href;
    const datetime = parseDate(card.find('div[class^="news-article-card_date"]').text().trim());

    if (!title || !url || !datetime) return;

    articles.push({
      title,
      url,
      published: new Date(datetime),
    });
  });

  return articles;
}

/* ---------------- Delta logic ---------------- */

async function getUnpostedArticles() {
  const state = loadState();
  const articles = await getLatestNewsArticles();

  if (!state) {
    const newest = new Date(Math.max(...articles.map((a) => a.published)));
    saveState(newest, []);
    return [];
  }

  const { lastPublished, postedUrls } = state;
  const unposted = [];

  for (const article of articles) {
    if (article.published > lastPublished) {
      unposted.push(article);
    } else if (article.published.getTime() === lastPublished.getTime() && !postedUrls.includes(article.url)) {
      unposted.push(article);
    }
  }

  return unposted.sort((a, b) => a.published - b.published);
}

/* ---------------- Discord webhook ---------------- */

async function postToDiscord(article, retries = 3) {
  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `**${article.title}**\n${article.url}`,
    }),
  });

  if (res.status === 429 && retries > 0) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 5;
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return postToDiscord(article, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}

/* ---------------- Main ---------------- */

(async () => {
  const newArticles = await getUnpostedArticles();

  for (const article of newArticles) {
    try {
      await postToDiscord(article);
    } catch (err) {
      console.error(`Failed to post: ${article.title}`, err);
    }
  }

  if (newArticles.length) {
    const newestDate = new Date(Math.max(...newArticles.map((a) => a.published)));

    const urlsAtNewestTimestamp = newArticles
      .filter((a) => a.published.getTime() === newestDate.getTime())
      .map((a) => a.url);

    saveState(newestDate, urlsAtNewestTimestamp);
  }
})();
