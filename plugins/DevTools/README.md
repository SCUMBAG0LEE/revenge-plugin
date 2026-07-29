# DevTools

A powerful developer plugin for the **Discord Revenge** client. This plugin equips you with a unified slash command to seamlessly debug, reverse engineer, and dump internal module state securely.

## 🐛 Features

* **`/debug`**: The ultimate module debugger.
  - **`query`**: Select from preset choices like `getMaxFileSize` or manually type any string you want to search.
  - **`mode`**: 
    - `fuzzy`: Finds modules containing your query substring.
    - `exact`: Finds a module matching your exact property name.
    - `dump_all`: Literally dumps every single Discord module in memory.
  - **`output`**: 
    - `share`: Outputs to the OS Share menu. Massive outputs (e.g. `dump_all`) are automatically securely uploaded to your configured VaultRelay server (or public pastebins as fallback) to prevent Android intent size limits!
    - `chat`: Chunks the output into 1900-character segments directly in the chat view.

## 📥 Installation

Copy this link and paste it into the Revenge Plugin Installer inside Discord:
`https://scumbag0lee.github.io/revenge-plugin/DevTools/`

## ⚙️ Usage

Once installed, simply type `/debug` in any chat window. 
All outputs from DevTools are rendered locally as bot messages, meaning they are completely invisible to anyone else in the server!
