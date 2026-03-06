import path from 'path';
import { fileURLToPath } from 'url';
import { fetchArticles as fetchArc } from '../arc-raiders/fetcher.js';
import { fetchArticles as fetchNight } from '../nightreign/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const sites = [
  {
    name: 'Arc Raiders',
    envVar: 'DISCORD_ARCRAIDERS_WEBHOOK',
    stateFile: path.resolve(__dirname, '../arc-raiders/state.json'),
    fetchArticles: fetchArc,
  },
  {
    name: 'Nightreign',
    envVar: 'DISCORD_NIGHTREIGN_WEBHOOK',
    stateFile: path.resolve(__dirname, '../nightreign/state.json'),
    fetchArticles: fetchNight,
  },
];
