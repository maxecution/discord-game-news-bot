import fs from 'fs';
import path from 'path';

export function loadState(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
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

export function saveState(file, date, postedUrls) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = `${file}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify(
      {
        last_published: date.toISOString(),
        posted_urls: postedUrls,
      },
      null,
      2,
    ),
  );
  fs.renameSync(tmp, file);
}

export function updateStateFromNewArticles(state, newArticles) {
  if (!newArticles.length) return state;

  const newestDate = new Date(Math.max(...newArticles.map((a) => a.published.getTime())));

  const urlsAtNewestTimestamp = newArticles
    .filter((a) => a.published.getTime() === newestDate.getTime())
    .map((a) => a.url);

  if (!state || newestDate > state.lastPublished) {
    return {
      lastPublished: newestDate,
      postedUrls: urlsAtNewestTimestamp,
    };
  }

  const merged = new Set([...(state.postedUrls || []), ...urlsAtNewestTimestamp]);

  return {
    lastPublished: newestDate, // equal to state.lastPublished here
    postedUrls: [...merged],
  };
}
