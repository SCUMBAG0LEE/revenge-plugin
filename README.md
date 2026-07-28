# 📤 VaultRelay — Discord Revenge Plugin

A high-performance self-hosted file uploader plugin for **Discord Revenge** that automatically intercepts oversized attachments, uploads them to your personal server, and posts the download link in chat.

## ✨ Features

- **Auto-intercept** — Automatically detects attachments exceeding Discord's file size limit (e.g. 10 MB).
- **Self-hosted** — Upload to your own server (e.g. `https://megumin.me/grimoire`) with zero third-party reliance.
- **Secure** — Bearer token authentication prevents unauthorized uploads.
- **Ultra-Fast** — OpenResty (Nginx + Lua) streams uploads directly to disk with zero buffering.
- **Configurable** — Easily adjust server URL, auth token, and size threshold from the plugin settings page.

## 🛠️ Prerequisites

- [Bun](https://bun.sh/) (v1.0.0+) for building the JS bundle
- A Linux server with [OpenResty](https://openresty.org/) for the upload backend

## 📦 Building

```bash
# Install dependencies & build plugin bundle
cd js
bun install
bun run build
```

The compiled plugin bundle and `manifest.json` will be generated at `js/build/revenge/`.

## 📱 How to Install in Revenge App

1. Push your code to GitHub `main` branch (GitHub Pages will automatically build & deploy your plugin).
2. In the **Revenge** Discord app on your phone:
   - Go to **User Settings** ⚙️ → **Revenge** → **Plugins**.
   - Tap the **`+`** (Install Plugin) button in the top right.
   - Enter your clean **GitHub Pages plugin URL**:
     ```text
     https://scumbag0lee.github.io/revenge-plugin/
     ```
     *(Or fallback GitHub Raw URL: `https://raw.githubusercontent.com/SCUMBAG0LEE/revenge-plugin/main/js/build/revenge/`)*
3. Tap **Install**, then open **VaultRelay Settings** inside the Revenge plugins list to enter your **Server URL** (`https://megumin.me/grimoire`) and your **API Token**!

## 🖥️ Server Setup

See [`server/nginx.conf.snippet`](server/nginx.conf.snippet) for the OpenResty configuration and [`server/upload_handler.lua`](server/upload_handler.lua) for the Lua upload handler.

```bash
# 1. Create upload directory
sudo mkdir -p /var/www/uploads/grimoire
sudo chown www-data:www-data /var/www/uploads/grimoire

# 2. Copy Lua handler
sudo cp server/upload_handler.lua /etc/openresty/lua/upload_handler.lua

# 3. Add the location blocks from nginx.conf.snippet to your server block

# 4. Generate a secret token using OpenSSL:
#    openssl rand -hex 32
#
#    Then set your token at the TOP of /etc/openresty/nginx.conf
#    (BEFORE the http { } block):
#    env FILEHOST_AUTH_TOKEN=your-generated-secret-token;

# 5. Reload OpenResty
sudo systemctl reload openresty
```

### 🔧 Server Environment Variables

All server-side configuration is driven by `env` directives in `nginx.conf`. Only `FILEHOST_AUTH_TOKEN` is required — the rest have sensible defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `FILEHOST_AUTH_TOKEN` | `CHANGE_ME` | **Required.** Bearer token for upload authentication |
| `FILEHOST_UPLOAD_DIR` | `/var/www/uploads/grimoire/` | Filesystem path where uploaded files are stored |
| `FILEHOST_PUBLIC_PATH` | `/grimoire/` | URL path prefix used in the returned download link |
| `FILEHOST_CHUNK_SIZE` | `8192` | Streaming chunk size in bytes |

### 🎨 Customisation Examples

<details>
<summary><b>Use a different URL path (e.g. <code>/vault/</code>)</b></summary>

1. Set env vars in `nginx.conf`:
   ```nginx
   env FILEHOST_PUBLIC_PATH=/vault/;
   env FILEHOST_UPLOAD_DIR=/var/www/uploads/vault/;
   ```
2. Update the `location` blocks in your server config to use `/vault/` instead of `/grimoire/`
3. Create the upload directory: `sudo mkdir -p /var/www/uploads/vault`
4. Update the plugin's **Server URL** setting to `https://yourdomain.com/vault`

</details>

<details>
<summary><b>Use a different domain</b></summary>

No Lua code changes needed! The handler auto-detects the `Host` header.

1. Point your DNS and nginx `server_name` to the new domain
2. Update the plugin's **Server URL** setting to match (e.g. `https://files.example.com/grimoire`)

</details>

---

## ⚙️ Plugin Settings

All plugin settings are configurable from the Revenge settings page.

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `https://megumin.me/grimoire` | Your upload server endpoint |
| API Token | *(empty)* | Bearer token for authentication |
| Max File Size (MB) | `10` | Files larger than this are auto-uploaded |
| Auto Upload | `true` | Upload automatically without prompting |

## 📜 License

GPL-3.0 License
