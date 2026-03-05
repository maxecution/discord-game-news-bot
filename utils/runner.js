import { loadState, saveState, updateStateFromNewArticles } from './state.js';
import { getUnpostedArticles } from './delta.js';
import { postToDiscord } from './discord.js';

export async function runNewsScraper({
  name,
  fetchArticles,
  webhook,
  stateFile,
  bootstrapStrategy = 'skip', // 'skip' | 'post'
  rateLimit = { minMs: 0, maxMs: 0 }, // optional polite delay between posts
  logger = console,
}) {
  if (!webhook) throw new Error(`${name}: webhook is not set`);

  try {
    const state = loadState(stateFile);
    const articles = await fetchArticles();

    if (!Array.isArray(articles) || !articles.length) {
      logger.warn(`${name}: No articles found.`);
      return;
    }

    const seen = new Set();
    const unique = articles.filter((a) => {
      if (!a?.url || !a?.published) return false;
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    if (!state) {
      if (bootstrapStrategy === 'post') {
        // If no state exists, post all scraped articles (oldest first)
        unique.sort((a, b) => a.published - b.published);
        const successfullyPosted = [];
        for (const article of unique) {
          try {
            await postToDiscord(webhook, article);
            successfullyPosted.push(article);
            logger.log(`${name}: Posted (bootstrap): ${article.title}`);
            await maybeDelay(rateLimit);
          } catch (err) {
            logger.error(`${name}: Failed to post during bootstrap: ${article.title}`, err);
          }
        }
        if (successfullyPosted.length) {
          const newState = updateStateFromNewArticles(
            { lastPublished: new Date(0), postedUrls: [] },
            successfullyPosted,
          );
          saveState(stateFile, newState.lastPublished, newState.postedUrls);
          logger.log(`${name}: State initialised (post-all bootstrap).`);
        } else {
          // Fall back to skip if nothing posted
          const newest = new Date(Math.max(...unique.map((a) => a.published.getTime())));
          saveState(stateFile, newest, []);
          logger.log(`${name}: State initialised. No articles posted.`);
        }
        return;
      } else {
        const newest = new Date(Math.max(...unique.map((a) => a.published.getTime())));
        saveState(stateFile, newest, []);
        logger.log(`${name}: State initialised. No articles posted.`);
        return;
      }
    }

    const newArticles = getUnpostedArticles(unique, state);

    if (!newArticles.length) {
      logger.log(`${name}: No new articles.`);
      return;
    }

    const successfullyPosted = [];

    for (const article of newArticles) {
      try {
        await postToDiscord(webhook, article);
        successfullyPosted.push(article);
        logger.log(`${name}: Posted: ${article.title}`);
        await maybeDelay(rateLimit);
      } catch (err) {
        logger.error(`${name}: Failed to post: ${article.title}`, err);
      }
    }

    if (successfullyPosted.length) {
      const newState = updateStateFromNewArticles(state, successfullyPosted);
      saveState(stateFile, newState.lastPublished, newState.postedUrls);
      logger.log(`${name}: State updated.`);
    }
  } catch (err) {
    throw new Error(`${name} scraper failed: ${err.message}`);
  }
}

async function maybeDelay(rateLimit) {
  const { minMs = 0, maxMs = 0 } = rateLimit || {};
  if (minMs <= 0 && maxMs <= 0) return;
  const span = Math.max(0, maxMs - minMs);
  const delay = minMs + Math.random() * span;
  return new Promise((r) => setTimeout(r, delay));
}
