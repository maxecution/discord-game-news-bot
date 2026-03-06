# Game News > Discord Webhook

This repository contains a set of lightweight scrapers that periodically check official game news pages and post **newly published articles** to Discord channels using **Discord webhooks**.

The system is designed to:

- run on a schedule (via GitHub Actions)
- require no always-on bot or server
- avoid duplicate posts
- support multiple games and channels cleanly
- make adding new games low-effort and low-risk

---

## How it works

At a high level:

1.  A GitHub Actions workflow runs on a cron schedule
2.  A single **execution script** runs all configured game scrapers
3.  For each game:
    - the game’s official news page is fetched
    - the most recent articles are extracted
    - they are compared against a locally stored state file
    - **only newly published articles** are posted to Discord via a webhook
4.  Updated state files are committed back to the repository so the next run knows what was already posted

Each game is logically isolated:

- its own scraping logic
- its own state file
- its own Discord webhook / channel

Execution, posting, and state handling are shared.

---

## Repository structure

```text
.
├── arc-raiders/
│   ├── fetcher.js        # Scraping logic for Arc Raiders news
│   └── state.json        # Last posted article state (committed)
├── nightreign/
│   ├── fetcher.js        # Scraping logic for Elden Ring: Nightreign news
│   └── state.json
├── sites/
│   ├── index.js          # Registry of all configured games
│   └── execution.js     # Orchestrates and runs all scrapers
├── utils/
│   ├── runner.js         # Shared scraper execution logic
│   ├── http.js           # Fetch with retry / headers
│   ├── state.js          # State load/save/update helpers
│   ├── delta.js          # New-article detection logic
│   └── discord.js        # Discord webhook posting
├── .github/
│   └── workflows/
│       └── news-cron.yml # GitHub Actions cron workflow
├── package.json
└── README.md
```

When additional games are added, they follow the same pattern:

```text
helldivers/
├── fetcher.js
└── state.json
```

---

## Technology choices

- **Node.js 20**
- **cheerio** for HTML parsing
- **Discord webhooks** (not a persistent bot)
- **GitHub Actions** for scheduling and execution

This avoids:

- hosting costs
- long-running processes
- Discord bot permissions management
- rate-limited polling services

---

## State management

Each game keeps a small JSON state file:

```json
{
  "last_published": "2026-01-15T11:57:48.000Z",
  "posted_urls": ["https://example.com/news/article-1"]
}
```

This file is:

- committed to the repository
- updated only when new articles are successfully posted
- used to prevent duplicate Discord posts (including articles sharing the same timestamp)

On the **first run**, the scraper records the most recent article as a baseline and does **not** post anything by default (available bootstrapping option to post all initially fetched articles).

---

## Discord setup (required)

This project uses **Discord webhooks**, not a logged-in bot.

For each game/channel:

1.  In Discord:
    - Open the channel settings
    - Create a webhook
    - Copy the webhook URL

2.  In GitHub:
    - Go to your repository > Settings > Secrets and variables > Actions
    - Add a repository secret:
      - Name: `DISCORD_<GAME>_WEBHOOK`
      - Value: the webhook URL

Example:

```text
DISCORD_NIGHTREIGN_WEBHOOK
```

Each game has its own webhook and can post to a different channel if desired.

---

## GitHub Actions workflow

The workflow (`news-cron.yml`) runs on a fixed schedule and executes **a single entry point** that runs all configured scrapers.

Example:

```yaml
- name: Run all scrapers
  run: node sites/execution.js
  env:
    DISCORD_NIGHTREIGN_WEBHOOK: ${{ secrets.DISCORD_NIGHTREIGN_WEBHOOK }}
    DISCORD_ARCRAIDERS_WEBHOOK: ${{ secrets.DISCORD_ARCRAIDERS_WEBHOOK }}
```

After execution completes, any updated `state.json` files are committed back to the repository.

---

## Forking and using this repository yourself

To use this repo for your own Discord server:

### 1. Fork the repository

Click **Fork** on GitHub and create your own copy.

---

### 2. Create Discord webhooks

For each channel you want news posted to:

- create a webhook in Discord
- copy the webhook URL

---

### 3. Configure GitHub secrets

In your forked repo:

- Settings > Secrets and variables > Actions
- Add one secret per game you want to run

Example:

```text
DISCORD_NIGHTREIGN_WEBHOOK = https://discord.com/api/webhooks/...
```

---

### 4. (Optional) Adjust the schedule

The default schedule is every 6 hours at minute 0:

```yaml
cron: '0 */6 * * *'
```

You can change this to hourly, daily, etc., depending on your needs.
(Note: GitHub actions are queued on shared runners, so short intervals may not run at desired times.)

---

### 5. Enable GitHub Actions

GitHub Actions are disabled by default on forks.

- Go to the **Actions** tab
- Enable workflows
- Additionally, grant the workflow read and write permissions under  
  Settings > Actions > General

---

### 6. Initial run behaviour

On the first successful run for a game:

- no Discord messages will be sent (default, can be changed if bootstrapStrategy is set to "post")
- the latest article will be recorded as the baseline

**New articles published after that point** will be posted on scheduled GH Action.

---

## Extending the repository

This repository is designed to make adding new games straightforward while keeping scraping logic isolated.

To add another game:

### 1. Create a new folder

```text
my-game/
├── fetcher.js
└── state.json
```

`fetcher.js` must export a single function:

```js
export async function fetchArticles() {
  return [
    { title, url, published },
    // ...
  ];
}
```

---

### 2. Register the game

Add an entry to `sites/index.js`:

```js
{
  name: 'My Game',
  envVar: 'DISCORD_MY_GAME_WEBHOOK',
  fetchArticles,
  stateFile: path.resolve(__dirname, '../my-game/state.json'),
  bootstrapStrategy: 'skip'/'post',
}
```

---

### 3. Add a Discord webhook secret

```text
DISCORD_MY_GAME_WEBHOOK
```

---

### 4. Tune scraping logic

Different games and publishers use different layouts, even on the same site.

Each `fetcher.js` is intentionally **site-specific** and should be tailored to:

- the game’s news URL
- the page’s DOM structure
- how publication dates are exposed

This project intentionally avoids trying to generalise scraping across sites, as doing so is fragile and error-prone.
