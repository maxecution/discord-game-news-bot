import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const URL = 'https://en.bandainamcoent.eu/elden-ring/elden-ring-nightreign/news';

const __dirname = new URL('.', import.meta.url).pathname;
const STATE_FILE = path.resolve(__dirname, 'state.json');
const WEBHOOK = process.env.DISCORD_NIGHTREIGN_WEBHOOK;

if (!WEBHOOK) {
  throw new Error('DISCORD_NIGHTREIGN_WEBHOOK is not set');
}

/* ---------------- State ---------------- */

function loadLastPublished() {
  if (!fs.existsSync(STATE_FILE)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const date = raw.last_published ? new Date(raw.last_published) : null;
    return date && !isNaN(date) ? date : null;
  } catch {
    return null;
  }
}

function saveLastPublished(date) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ last_published: date.toISOString() }, null, 2));
}

/* ---------------- Scrape ---------------- */

async function getLatestNewsArticles() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const section = $('h2#news').closest('div.search__section');
  if (!section.length) throw new Error('News section not found');

  const list = section.find('ul.cards-list').first();
  if (!list.length) throw new Error('Cards list not found');

  const articles = [];

  list.find('li.node__thumbnail').each((_, el) => {
    const card = $(el);
    const title = card.find('h3.card__title').text().trim();
    const url = card.find('a.card').attr('href');
    const datetime = card.find('time').attr('datetime');

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
  const lastSeen = loadLastPublished();
  const articles = await getLatestNewsArticles();

  if (!lastSeen) {
    const newest = new Date(Math.max(...articles.map((a) => a.published)));
    saveLastPublished(newest);
    return [];
  }

  if (articles.length === 3 && Math.min(...articles.map((a) => a.published)) > lastSeen) {
    console.warn('Exactly 3 articles all newer than last seen; older posts may have been missed.');
  }

  return articles.filter((a) => a.published > lastSeen).sort((a, b) => a.published - b.published);
}

/* ---------------- Discord webhook ---------------- */

async function postToDiscord(article) {
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
    const newest = new Date(Math.max(...newArticles.map((a) => a.published)));
    saveLastPublished(newest);
  }
})();
