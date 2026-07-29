# SCUMBAG0LEE's Revenge Plugins

A collection of high-quality plugins for the **Discord Revenge** client. This repository is structured as a monorepo, meaning multiple plugins are built and hosted from here automatically via GitHub Pages.

## 🧩 Available Plugins

| Plugin | Description | Install Link |
|--------|-------------|--------------|
| [**VaultRelay**](./plugins/VaultRelay) | Self-hosted, zero-buffer file uploader for oversized attachments with automatic UI state cleanup. | `https://scumbag0lee.github.io/revenge-plugin/VaultRelay/` |
| [**RedditFetch**](./plugins/RedditFetch) | Fetch random images from any subreddit. Includes custom DNS/Proxy bypass feature. | `https://scumbag0lee.github.io/revenge-plugin/RedditFetch/` |
| [**DevTools**](./plugins/DevTools) | Essential developer tools for Vendetta. Features massive output handling via paste.gg integration. | `https://scumbag0lee.github.io/revenge-plugin/DevTools/` |

> *Click on a plugin's name above to view its detailed documentation, server setup guides, and features!*

---

## 📱 How to Install in Revenge

1. Open the **Revenge** Discord app on your phone.
2. Go to **User Settings** ⚙️ → **Revenge** → **Plugins**.
3. Tap the **`+`** (Install Plugin) button in the top right.
4. Enter the **Install Link** for the plugin you want (listed in the table above).
5. Tap **Install**, then configure any necessary options in the Plugin Settings!

---

## 📦 Building from Source

This repo uses [Bun](https://bun.sh/) for ultra-fast bundling.

```bash
# Install dependencies & build all plugins
bun install
bun run build
```

Compiled plugins will be generated in `dist/[PluginName]`.

## 📜 License

GPL-3.0 License
