export function getUnpostedArticles(articles, state) {
  if (!articles.length) return [];

  if (!state) return [];

  const { lastPublished, postedUrls } = state;

  const unposted = articles.filter((article) => {
    if (article.published > lastPublished) return true;

    if (article.published.getTime() === lastPublished.getTime() && !postedUrls.includes(article.url)) {
      return true;
    }

    return false;
  });

  return unposted.sort((a, b) => a.published - b.published);
}
