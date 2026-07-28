# 📤 VaultRelay

A high-performance self-hosted file uploader plugin for **Discord Revenge** that automatically intercepts oversized attachments, uploads them to your personal server, and posts the download link in chat.

**Install Link**: `https://scumbag0lee.github.io/revenge-plugin/VaultRelay/`

## ✨ Features

- **Auto-intercept** — Automatically detects attachments exceeding Discord's file size limit (e.g. 10 MB).
- **Self-hosted** — Upload to your own server (e.g. `https://megumin.me/grimoire`) with zero third-party reliance.
- **Secure** — Bearer token authentication prevents unauthorized uploads.
- **Ultra-Fast** — OpenResty (Nginx + Lua) streams uploads directly to disk with zero buffering.
- **Configurable** — Easily adjust server URL, auth token, and size threshold from the plugin settings page.

## 🖥️ Server Setup (OpenResty)

To use VaultRelay, you need a Linux server running [OpenResty](https://openresty.org/).
See the `server/` directory in the root of this repository for the required configuration files.

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

## ⚙️ Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | `https://megumin.me/grimoire` | Your upload server endpoint |
| API Token | *(empty)* | Bearer token for authentication |
| Max File Size (MB) | `10` | Files larger than this are auto-uploaded |
| Auto Upload | `true` | Upload automatically without prompting |
