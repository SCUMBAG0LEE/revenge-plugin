# 🦊 RedditFetch

Fetch random posts and images from any subreddit using a slick slash command in Discord! 

**Install Link**: `https://scumbag0lee.github.io/revenge-plugin/RedditFetch/`

## ✨ Features

- **Slash Command**: Use `/reddit [subreddit] [sort] [silent]` anywhere.
- **Dynamic NSFW Safety**: Automatically blocks NSFW Reddit posts if you try to use the command in an SFW Discord channel, preventing accidental bans.
- **DNS Censorship Bypass**: Set a custom API Base URL to route requests through a proxy or alternative frontend to bypass ISP or regional blocks.
- **Smart Embeds**: Automatically converts `.gifv` links to `.gif` so they render properly in the Discord app.

## ⚙️ Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default Subreddit | `pics` | The subreddit to fetch from if you run `/reddit` without arguments. |
| API Base URL | `https://api.reddit.com` | Custom endpoint for API requests. Useful for bypassing DNS blocking via proxies. |
| NSFW Warning | `true` | Prevent fetching NSFW posts while inside SFW channels. |
| Default Sort | `Hot` | How to sort the posts (Hot, New, Top, Best, etc). |
