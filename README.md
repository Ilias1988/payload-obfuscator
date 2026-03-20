# 🛡️ Payload Obfuscator — Red Team Evasion & AV/EDR Bypass Tool

🌐 **[Live Demo → payload-obfuscator.dev](https://payload-obfuscator.dev/)**

A **free, open-source, browser-based** payload obfuscation tool designed for red team operators, penetration testers, and security researchers. Supports **7 stackable obfuscation layers** across 5 languages with real-time **entropy analysis**, **detection scoring**, and **advanced logic obfuscation**.

> ⚠️ **For educational and authorized security testing purposes only.**

![Payload Obfuscator](screenshot.png)

---

## ✨ Features

### 🔤 5 Supported Languages
- ⚡ **PowerShell** (.ps1) — IEX Stealth auto-replacement, AMSI bypass ready
- 🐍 **Python** (.py) — f/r/b/u string prefix detection, getattr stealth encoding
- 🐚 **Bash** (.sh) — 55+ command obfuscation (printf hex), native Linux encoding
- 🔷 **C#** (.cs) — Verbatim string preservation, shellcode loader templates
- 🔹 **Go** (.go) — Safe byte slice encoding, raw string preservation

### 🧅 7 Obfuscation Layers (Stackable)

| # | Layer | Icon | Description |
|---|-------|------|-------------|
| 1 | **Variable Randomization** | 🎲 | Replace variable/function names with random identifiers |
| 2 | **String Encoding** | 🔐 | Encode strings with Base64, Hex, char codes, byte arrays |
| 3 | **Dead Code Injection** | 💀 | Insert non-functional code to alter control flow graph |
| 4 | **Anti-Analysis** | 🛡️ | Sandbox detection, sleep timers, environment checks |
| 5 | **XOR String Encryption** | ⚔️ | Encrypt each string with random XOR key + JIT decryption |
| 6 | **Control Flow Flattening** | 🌀 | Flatten code into randomized state-machine (while/switch) |
| 7 | **Encryption Wrapper** | 🔒 | Wrap entire payload in XOR envelope with runtime decrypt |

### 💎 v4.1 Diamond — Advanced Logic Obfuscation

**XOR String Encryption:**
- Each string gets a unique random key (4–8 bytes)
- Encrypted data stored as byte arrays
- Tiny decrypt helper injected once per output
- All plaintext strings eliminated from output

**Control Flow Flattening (Scope-Aware):**
- Splits code into blocks ONLY at `braceDepth === 0`
- Nested scopes (loops, if/else, try/catch) remain **atomic**
- try/catch/finally automatically absorbed as single block
- PowerShell pipelines (`|`) treated as single statements
- **Safe Mode**: skips CFF on malformed/complex input instead of breaking it
- Preamble extraction: `using`, `import`, `class`, `func` never enter the switch

**IEX Stealth Mode (PowerShell):**
- Auto-replaces `IEX`/`Invoke-Expression` with `& ($ShellId[1]+$ShellId[13]+'X')`
- Context-aware: only in code tokens, never inside strings
- Green "STEALTH" badge in UI when active

### 📊 Real-time Analysis
- Shannon Entropy meter with High/Medium/Low classification
- Detection probability scoring with per-layer breakdown
- Before/After size comparison and ratio
- Output validation with balanced-delimiter warnings

### 🎨 UI Features
- 👑 **Platinum Badge**: Blue pulsing Crown when XOR or CFF active
- 🛡️ **Stealth Badge**: Green ShieldCheck when IEX stealth active
- 📋 Template Library: 7 pre-built payload skeletons
- 📥 One-click copy & download
- 🌙 Dark terminal-style responsive UI

---

## 🔍 SEO & Crawlability

- Dynamic `<title>` and `<meta description>` per selected language
- JSON-LD structured data: `WebApplication`, `FAQPage`, `BreadcrumbList`
- Educational 400+ word section on evasion theory (pre-rendered)
- `<noscript>` fallback with full educational content for crawlers
- Puppeteer pre-render script for static HTML generation
- `robots.txt` + `sitemap.xml` included

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build:only

# Build + pre-render for SEO
npm run build

# Deploy to GitHub Pages
npm run deploy
```

---

## 📁 Project Structure

```
Payload-Obfuscator/
├── index.html                  # SEO-optimized shell + noscript fallback
├── scripts/
│   ├── prerender.js            # Puppeteer pre-rendering script
│   └── build.mjs               # Production build script
├── public/
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── App.jsx                 # Main application
│   ├── main.jsx                # React entry point
│   ├── index.css               # Tailwind + custom styles
│   ├── components/
│   │   ├── layout/             # Header, Footer
│   │   ├── panels/             # Input, Output, Options, Analysis, Language
│   │   ├── seo/                # SEOHead (dynamic meta), SEOContent (educational)
│   │   └── ui/                 # CopyButton, EntropyMeter, Toast
│   ├── data/
│   │   └── techniques.js       # Languages, 7 layers, 7 templates
│   ├── engines/
│   │   ├── powershell.js       # PS engine (IEX stealth + 7 layers)
│   │   ├── python.js           # Python engine (prefix-aware + 6 layers)
│   │   ├── bash.js             # Bash engine (55+ cmds + 6 layers)
│   │   ├── csharp.js           # C# engine (verbatim-safe + 7 layers)
│   │   ├── golang.js           # Go engine (byte slice + 7 layers)
│   │   └── controlflow.js      # 💎 Scope-Aware CFF engine (v4.1)
│   ├── hooks/
│   │   └── useObfuscator.js    # Core state management + platinumActive
│   └── utils/
│       ├── encoding.js         # Base64, Hex, XOR, xorEncryptForLanguage()
│       ├── entropy.js          # Shannon entropy + detection scoring
│       ├── parser.js           # Context-aware tokenizer (prefix detection)
│       ├── randomization.js    # Variable/function name generation
│       └── validator.js        # Output validation (balanced delimiters)
```

---

## 🛠️ Tech Stack

- **React 18** + Vite 5
- **Tailwind CSS 3.4** (dark terminal theme)
- **Lucide React** (icons)
- **React Helmet Async** (dynamic SEO)
- **Puppeteer** (pre-rendering)

---

## 📌 Version History

| Version | Codename | Highlights |
|---------|----------|------------|
| v1.0 | — | 5 languages, 5 layers, basic obfuscation |
| v2.0 | — | Context-aware parser, string-safe encoding |
| v3.0 | Gold | IEX Stealth, AMSI templates, entropy analysis |
| v3.1 | Gold Fix | Python f-string prefix detection fix |
| v4.0 | Platinum | XOR String Encryption, Control Flow Flattening, Platinum badge |
| v4.1 | 💎 Diamond | Scope-aware CFF rewrite (brace counting, atomic try/catch, safe mode) |

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

## 👤 Author

**Ilias Georgopoulos**

- [Website](https://ilias1988.me/)
- [GitHub](https://github.com/Ilias1988)
- [X/Twitter](https://x.com/EliotGeo)
