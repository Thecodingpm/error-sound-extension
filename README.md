# 🔊 Error Sound – Meme Edition

> **Play hilarious meme sounds every time your code explodes.**  
> Terminal errors, build failures, and diagnostics have never been more entertaining.

![VS Code](https://img.shields.io/badge/VS%20Code-≥1.80-blue?logo=visual-studio-code)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎯 **Multi-source detection** | Terminal output, Problems panel, and failed tasks |
| 🎲 **Random mode** | Different meme each time – never gets old |
| ⏱️ **Cooldown system** | Prevents sound spam during rapid errors |
| 🔊 **Status bar control** | See & change your current sound with one click |
| ⚙️ **Full settings** | Volume, cooldown, enable/disable, keyword list |
| 🖥️ **Cross-IDE** | Works in VS Code, Cursor, Windsurf, VSCodium |

---

## 🎵 Included Sounds

| ID | Sound | Description |
|---|---|---|
| `vineboom` | Vine Boom | The internet classic |
| `metalpipe` | Metal Pipe | Satisfying clang |
| `faaah` | Faaah | Dramatic exhale |
| `xp-error` | Windows XP Error | Nostalgic Windows chime |

> **Add your own sounds** by dropping `.mp3` files into the `sounds/` folder and reloading.

---

## 🚀 Installation

### From VSIX (manual)
```bash
# 1. Clone or download this repo
git clone https://github.com/yourname/error-sound-extension.git
cd error-sound-extension

# 2. Install dependencies
npm install

# 3. Add sound files to sounds/
#    (vineboom.mp3, metalpipe.mp3, faaah.mp3, xp-error.mp3)

# 4. Compile TypeScript
npm run compile

# 5. Package as VSIX
npx vsce package

# 6. Install in VS Code
code --install-extension error-sound-extension-1.0.0.vsix
```

### From VS Code Marketplace
Search for **"Error Sound Meme"** in the Extensions panel, or:
```
ext install your-publisher-id.error-sound-extension
```

---

## ⚙️ Configuration

Open **Settings** (`Ctrl+,`) and search for **Error Sound**.

| Setting | Default | Description |
|---|---|---|
| `errorSound.enabled` | `true` | Master on/off switch |
| `errorSound.selectedSound` | `vineboom` | Active sound ID |
| `errorSound.randomMode` | `false` | Random sound each error |
| `errorSound.volume` | `0.8` | Volume (0.0 – 1.0) |
| `errorSound.cooldownMs` | `3000` | Milliseconds between triggers |
| `errorSound.detectTerminal` | `true` | Watch terminal output |
| `errorSound.detectDiagnostics` | `true` | Watch Problems panel |
| `errorSound.detectTasks` | `true` | Watch task exit codes |
| `errorSound.customErrorKeywords` | `[]` | Extra keywords to detect |

### Example `settings.json`
```json
{
  "errorSound.enabled": true,
  "errorSound.selectedSound": "metalpipe",
  "errorSound.randomMode": false,
  "errorSound.volume": 0.9,
  "errorSound.cooldownMs": 2000,
  "errorSound.customErrorKeywords": ["ohno", "critical"]
}
```

---

## 🎮 Commands

Open the Command Palette (`Ctrl+Shift+P`) and type **Error Sound**:

| Command | Description |
|---|---|
| `Error Sound: Change Error Sound` | Open sound picker menu |
| `Error Sound: Toggle Sound Extension` | Enable / disable the extension |
| `Error Sound: Enable Random Mode` | Switch to random sound mode |
| `Error Sound: Test Current Sound` | Preview the active sound |

---

## 📊 Status Bar

The status bar (bottom right) always shows your active sound:

```
🍇 Vineboom    ← click to change
🔩 Metalpipe
😩 Faaah
💻 Xp-error
🎲 Random Sound
🔇 Sounds Off
```

---

## 🔍 Error Detection Details

### Terminal
The extension listens for `onDidWriteTerminalData` (VS Code ≥ 1.87). If your
IDE doesn't support it, add `--enable-proposed-api error-sound-extension` to
your VS Code launch flags as a workaround.

### Problems Panel
Fires when the **error count increases** in any open workspace file.

### Tasks
Fires when any VS Code task (build, test, etc.) exits with a **non-zero** exit code.

### Built-in error keywords
```
error • failed • exception • syntaxerror • segmentation fault
build failed • traceback • fatal error • unhandled • panic • abort
```
You can extend this list via `errorSound.customErrorKeywords`.

---

## 🛠️ Development

```bash
# Install deps
npm install

# Watch-compile TypeScript
npm run watch

# Launch Extension Development Host
# Press F5 in VS Code

# Build once
npm run compile

# Package for distribution
npx vsce package

# Publish to VS Code Marketplace
npx vsce publish

# Publish to Open VSX (Cursor, Windsurf, VSCodium)
npx ovsx publish
```

---

## 🤝 Contributing

1. Fork the repo
2. Add your sound to `sounds/` and register it in `BUILTIN_SOUNDS` (extension.ts) and `package.json` enum
3. Open a PR 🎉

---

## 📄 License

MIT © 2024
