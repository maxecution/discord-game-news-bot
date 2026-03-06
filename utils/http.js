export async function fetchWithRetry(url, attempts = 3) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;

      console.warn(`${url} fetch attempt ${attempt} failed: HTTP ${res.status}`);
    } catch (err) {
      console.warn(`${url} fetch attempt ${attempt} errored:`, err.message);
    }

    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }

  return null;
}
