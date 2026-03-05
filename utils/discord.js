export async function postToDiscord(webhookUrl, article, retries = 3) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `**${article.title}**\n${article.url}`,
    }),
  });

  if (res.status === 429 && retries > 0) {
    const resetAfter =
      Number(res.headers.get('X-RateLimit-Reset-After')) || Number(res.headers.get('Retry-After')) || 5;
    const jitter = Math.random() * 0.5;
    await new Promise((r) => setTimeout(r, (resetAfter + jitter) * 1000));
    return postToDiscord(webhookUrl, article, retries - 1);
  }

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}
