# 🦊 RedditFetch

Fetch random posts and images from any subreddit using a slick slash command in Discord! 

**Install Link**: `https://scumbag0lee.github.io/revenge-plugin/RedditFetch/`

## ✨ Features

- **Slash Command**: Use `/reddit [subreddit] [sort] [silent]` anywhere.
- **Megumin Persona**: When posting silently, the embed is sent locally using a custom Megumin bot profile!
- **Dynamic NSFW Safety**: Automatically blocks NSFW Reddit posts if you try to use the command in an SFW Discord channel, preventing accidental bans.
- **Smart Embeds**: Automatically converts `.gifv` links to `.gif` so they render properly in the Discord app.

## ⚙️ Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Default Subreddit | `Megumin` | The subreddit to fetch from if you run `/reddit` without arguments. |
| NSFW Warning | `true` | Prevent fetching NSFW posts while inside SFW channels. |
| Default Sort | `Hot` | How to sort the posts (Hot, New, Top, Best, etc). |
