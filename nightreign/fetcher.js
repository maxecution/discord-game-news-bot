import { load } from 'cheerio';
import { fetchWithRetry } from '../utils/http.js';

const NEWS_URL = 'https://en.bandainamcoent.eu/elden-ring/elden-ring-nightreign/news';

export async function fetchArticles() {
  const res = await fetchWithRetry(NEWS_URL);
  if (!res) {
    console.warn('Nightreign fetch abandoned after retries');
    return [];
  }
  const html = await res.text();
  const $ = load(html);

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
    const published = new Date(datetime);
    if (Number.isNaN(published.getTime())) return;
    articles.push({ title, url, published });
  });
  return articles;
}
