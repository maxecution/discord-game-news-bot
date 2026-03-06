import { runNewsScraper } from '../utils/runner.js';
import { sites } from './index.js';

async function main() {
  const results = [];

  for (const site of sites) {
    const webhook = process.env[site.envVar];
    try {
      await runNewsScraper({
        name: site.name,
        fetchArticles: site.fetchArticles,
        webhook,
        stateFile: site.stateFile,
        bootstrapStrategy: site.bootstrapStrategy ?? 'skip',
        rateLimit: { minMs: 250, maxMs: 750 },
      });
      results.push({ site: site.name, ok: true });
    } catch (err) {
      console.error(err?.message || err);
      results.push({ site: site.name, ok: false, error: err?.message });
    }
  }

  const anyFailed = results.some((r) => !r.ok);
  if (anyFailed) process.exit(1);
}

main();
