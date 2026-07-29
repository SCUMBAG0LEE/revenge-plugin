# DevTools

A powerful developer plugin for the **Discord Revenge** client. This plugin equips you with a unified slash command to seamlessly debug, reverse engineer, and dump internal module state securely.

## 🐛 Features

* **`/debug`**: The ultimate module debugger.
  - **`query`**: Select from preset choices like `getMaxFileSize` or manually type any string you want to search.
  - **`mode`**: 
    - `fuzzy`: Finds modules containing your query substring.
    - `exact`: Finds a module matching your exact property name.
    - `dump_all`: Literally dumps every single Discord module in memory.
  - **`to_clipboard`**: Toggle this to securely copy the giant JSON output straight to your phone's clipboard, bypassing chat spam and Discord's 2000-character limit completely!

## 📥 Installation

Copy this link and paste it into the Revenge Plugin Installer inside Discord:
`https://scumbag0lee.github.io/revenge-plugin/DevTools/`

## ⚙️ Usage

Once installed, simply type `/debug` in any chat window. 
All outputs from DevTools are rendered locally as bot messages, meaning they are completely invisible to anyone else in the server!
