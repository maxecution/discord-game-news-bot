# Game News > Discord Webhook

This repository contains a set of lightweight scrapers that periodically check official game news pages and post **newly published articles** to Discord channels using **Discord webhooks**.

The system is designed to:

- run on a schedule (via GitHub Actions)
- require no always-on bot or server
- avoid duplicate posts
- support multiple games and channels cleanly

---

## How it works

At a high level:

1. A GitHub Actions workflow runs on a cron schedule (every 15 minutes by default)
2. Each game-specific scraper:
   - fetches the game’s official news page
   - extracts the most recent articles
   - compares them against a locally stored “last posted” timestamp
   - posts **only new articles** to Discord via a webhook
3. The updated state is committed back to the repository so the next run knows what was already posted

Each game is fully isolated:

- its own scraper
- its own state file
- its own Discord webhook / channel

---

## Repository structure

```text

.
├── nightreign/
│   ├── check-news.js     # Scraper + webhook poster for Elden Ring: Nightreign
│   └── state.json        # Last posted article timestamp (committed)
├── .github/
│   └── workflows/
│       └── news-cron.yml # GitHub Actions cron workflow
├── package.json
└── README.md
```

When additional games are added, they follow the same pattern:

```text

arc-raiders/
├── check-news.js
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

Each scraper keeps a small JSON state file:

```json
{
  "last_published": "2026-01-15T11:57:48.000Z"
}
```

This file is:

- committed to the repository
- updated only when new articles are successfully processed
- used to prevent duplicate Discord posts

On the **first run**, the scraper records the most recent article as a baseline and does **not** post anything.

---

## Discord setup (required)

This project uses **Discord webhooks**, not a logged-in bot.

For each game/channel:

1. In Discord:
   - Open the channel settings
   - Create a webhook
   - Copy the webhook URL

2. In GitHub:
   - Go to your repository > Settings > Secrets and variables > Actions
   - Add a repository secret:
     - Name: `DISCORD_<GAME>_WEBHOOK`
     - Value: the webhook URL

Example:

```
DISCORD_NIGHTREIGN_WEBHOOK
```

---

## GitHub Actions workflow

The workflow (`news-cron.yml`) runs on a fixed schedule and executes each scraper sequentially.

Example excerpt:

```yaml
- name: Check Nightreign news
  run: node nightreign/check-news.js
  env:
    DISCORD_NIGHTREIGN_WEBHOOK: ${{ secrets.DISCORD_NIGHTREIGN_WEBHOOK }}
```

After all scrapers run, updated state files are committed back to the repo.

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
- Add secrets matching the scripts you intend to run

Example:

```
DISCORD_NIGHTREIGN_WEBHOOK = https://discord.com/api/webhooks/...
```

---

### 4. (Optional) Adjust the schedule

The default schedule is every hour at minute 0:

```yaml
cron: '0 * * * *'
```

You can change this to hourly, daily, etc., depending on your needs.

---

### 5. Enable GitHub Actions

GitHub Actions are disabled by default on forks.

- Go to the **Actions** tab
- Enable workflows
- Additionally, grant the workflow read and write permissions under Setting > Actions > General

---

### 6. Initial run behaviour

On the first successful run:

- no Discord messages will be sent
- the latest article will be recorded as the baseline

Only _new_ articles published after that point will be posted.

---

## Extending the repository

This repository is designed to support multiple games, but **each scraper is source-specific**.

To add another game, you will need to:

1. Create a new folder:

```

my-game/
├── check-news.js
└── state.json

```

2. Update the scraper logic in `check-news.js`:

- Change the base news URL to the correct page for the game
- Adjust the DOM selectors (`cheerio`) to match that site’s HTML structure
- Ensure the scraper correctly extracts:
  - article title
  - article URL
  - publication timestamp

Different games or publishers may use different layouts, even on the same site.

3. Add a Discord webhook secret:

```

DISCORD_MY_GAME_WEBHOOK

```

4. Update the GitHub Actions workflow:

- Add a new step that runs the new scraper
- Pass the corresponding webhook secret as an environment variable

Each scraper is fully independent, but **the scraping logic must be tailored to the page it targets**.
This repository intentionally avoids attempting to generalise scraping across different sites, as doing so is fragile and error-prone.
