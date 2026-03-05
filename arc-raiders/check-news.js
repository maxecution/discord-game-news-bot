import { fileURLToPath } from 'url';
import path from 'path';
import { load } from 'cheerio';
import { runNewsScraper } from './utils/runner.js';
import { fetchWithRetry } from './utils/http.js';

const BASE_URL = 'https://arcraiders.com';
const NEWS_URL = `${BASE_URL}/news`;
const WEBHOOK = process.env.DISCORD_ARCRAIDERS_WEBHOOK;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'state.json');

// Arc Raiders only exposes a date (no time), parse as UTC midnight for consistency with Nightreign
function parseDate(text) {
  const date = new Date(`${text} UTC`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${text}`);
  return date;
}

async function fetchArticles() {
  const res = await fetchWithRetry(NEWS_URL);
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
    const dateText = card.find('div[class^="news-article-card_date"]').text().trim();
    const published = parseDate(dateText);
    articles.push({ title, url, published });
  });

  return articles;
}

(async () => {
  try {
    await runNewsScraper({
      name: 'Arc Raiders',
      fetchArticles,
      webhook: WEBHOOK,
      stateFile: STATE_FILE,
      rateLimit: { minMs: 250, maxMs: 750 },
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
