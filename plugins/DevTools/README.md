# DevTools

A powerful developer plugin for the **Discord Revenge** client. This plugin equips you with natively integrated slash commands to seamlessly debug, reverse engineer, and hot-evaluate code right inside your Discord chat.

## 🐛 Features

* **`/debug-props`**: Instantly search for any exact internal Discord module property and dump its entire list of exported keys into the chat. Perfect for finding what functions a module supports!
* **`/search-props`**: A fuzzy-finder for internal modules. Just type a keyword like `upload` or `size` and it will scan all modules in memory, returning every module that matches along with a preview of its properties. Use `full: true` to dump every key!
* **`/eval`**: Execute arbitrary JavaScript code natively within the Vendetta/Discord React Native runtime. Returns beautifully formatted JSON outputs.

## 📥 Installation

Copy this link and paste it into the Revenge Plugin Installer inside Discord:
`https://scumbag0lee.github.io/revenge-plugin/DevTools/`

## ⚙️ Usage

Once installed, simply type `/debug-props`, `/search-props`, or `/eval` in any chat window. 
All outputs from DevTools are rendered locally as bot messages, meaning they are completely invisible to anyone else in the server!
