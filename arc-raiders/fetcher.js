import { load } from 'cheerio';
import { fetchWithRetry } from '../utils/http.js';

const BASE_URL = 'https://arcraiders.com';
const NEWS_URL = `${BASE_URL}/news`;

// Arc Raiders only exposes a date (no time), parse as UTC midnight for consistency with Nightreign
function parseDate(text) {
  const date = new Date(`${text} UTC`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${text}`);
  return date;
}

export async function fetchArticles() {
  const res = await fetchWithRetry(NEWS_URL);
  if (!res) {
    console.warn('Arc Raiders fetch abandoned after retries');
    return [];
  }
  const html = await res.text();
  const $ = load(html);

  const section = $('section[class^="news-article-list_section"]');
  if (!section.length) throw new Error('News section not found');

  const articles = [];
  section.find('a[class^="news-article-row_row"]').each((_, el) => {
    const row = $(el);
    const title = row.find('[class^="news-article-row_title"]').text().trim();
    const href = row.attr('href');
    if (!href) return;
    const url = new URL(href, BASE_URL).href;
    const dateText = row.find('[class^="news-article-row_date"]').text().trim();
    const published = parseDate(dateText);
    articles.push({ title, url, published });
  });
  return articles;
}
