# CSSWebScraper

> **Production-grade, cross-browser web extension for extracting computed fonts, CSS color palettes, and media assets with interactive Color Code & Font Previews in a Neo-brutalist interface.**

Built with **Manifest V3** for Chromium (Chrome, Edge, Brave, Opera) and Gecko (Firefox 109+).

---

## 📦 Packaging Structure

```
CSSWebScraper/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── scripts/
│   └── content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🎨 Design System: Neobrutalism

- **Color Palette**:
  - **Background**: Pure White (`#FFFFFF`) with off-white panel accents (`#F4F4F0`).
  - **Primary Accent**: Hyper Blue (`#0055FF`).
  - **Typography & Borders**: Deep Black (`#000000`).
  - **Badges**: High-contrast Canary Yellow (`#FFE600`), Coral Pink (`#FF3366`), and Mint Lime (`#00D084`).
- **Styling Rules**:
  - **Typography**: Google Font `'DM Sans'` with `'JetBrains Mono'` for code snippets and metrics.
  - **Borders**: Strict `2.5px solid #000000` on cards, inputs, and interactive elements.
  - **Shadows**: Hard offset `3px 3px 0px #000000` (zero blur).
  - **Interactions**:
    - `:hover`: translates `(-1px, -1px)` with `4px 4px 0px #000000` shadow.
    - `:active`: translates `(2px, 2px)` with `1px 1px 0px #000000` shadow.
- **Dimensions & Container Hierarchy**:
  - Fixed popup window (`480px` wide × `560px` high).
  - **Equal-Size Uniform Containers**:
    - **Font Cards**: Strictly uniform `180px` height with full-width layout, clean single-line metadata, and horizontal scrolling weight chips.
    - **Color Cards**: Symmetrical `144px` height in a 2-column grid with a tall `60px` swatch, centered contrast preview label, and aligned actions.
    - **Image Cards**: Symmetrical `196px` height in a 2-column grid with a fixed `98px` centered thumbnail container and unclipped action rows.
    - **UI Preview Sandboxes & WCAG Cards**: Equalized fixed heights (`60px` and `54px`) for geometric alignment.

---

## ⚡ Core Features & Interactive Previews

### 1. 🔤 Interactive Font Inspector & Specimen Preview
- **Live Custom Text Tester**: Type any preview text directly in the Fonts toolbar; updates all font family cards in real time.
- **Font Size Toggles**: Switch between `14px`, `18px`, `24px`, and `30px` to test typography scale.
- **In-Card Weight Switcher**: Click on any detected weight badge (`400 Regular`, `700 Bold`, `600 SemiBold`) to instantly toggle that weight in the card's live preview.
- **Typographic Specimen Modal**:
  - Full character set waterfall: Uppercase (`A-Z`), Lowercase (`a-z`), Numerals (`0-9`), and Symbols (`!@#$%^&*()`).
  - Typographic Hierarchy preview: Display Headline (28px), Section Header (20px), and Body Paragraph (14px).
  - Interactive custom text input and live weight selector.
- **One-click Copy**: Copy full CSS `font-family` property.
- **Live Search**: Instant filtering by font family name.

### 2. 🎨 Interactive Color Code Preview & UI Sandbox
- **Color Code Breakdown**: Displays **HEX**, **RGB**, and **HSL** representations with dedicated one-click copy buttons for each format.
- **Live UI Component Previews**:
  - **Solid Button**: Neo-brutalist button preview with dynamic high-contrast text.
  - **Pill Badge**: Active status pill preview.
  - **Typography on Light**: Large heading preview on Pure White (`#FFFFFF`).
  - **Typography on Dark**: Large heading preview on Deep Charcoal (`#121212`).
- **WCAG 2.1 Contrast Matrix**:
  - Real-time mathematical contrast ratio calculation against White (`#FFFFFF`) and Black (`#000000`).
  - High-contrast compliance badges (`AAA PASS`, `AA PASS`, `FAIL`).
- **One-click "Export to :root"**:
  - Formats all detected colors into standard CSS custom properties (`--color-1: #0055FF;`).
  - Copies directly to clipboard with instant toast notification.
  - Generates and downloads a standalone `csswebscraper-[domain]-palette.css` file.
- **Filter Chips**: Filter by `All`, `Text`, `BG`, and `Border`.

### 3. 🖼️ Media & Image Assets Scraper
- Scrapes all `<img>` tags (`src`, `currentSrc`, `srcset`).
- Extracts CSS `background-image: url(...)` from computed styles.
- Serializes inline `<svg>` elements into clean SVG Data URIs.
- Captures `<video poster="...">` assets.
- Deduplicates identical targets and resolves relative URLs to absolute HTTP/HTTPS addresses.
- Computes natural or rendered bounding box dimensions (`W × H`).
- Checkered transparency backgrounds for alpha PNGs and SVGs.
- Single-click asset download and "Open in new tab".
- **Batch download**: Download selected images or all assets with a single click via `browserAPI.downloads.download`.

---

## 🚀 Installation & Loading

### Google Chrome / Brave / Edge / Opera (Chromium)
1. Open your browser and navigate to the Extensions management page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Select this directory: `c:\Users\maxpa\OneDrive\Documents\CSSScraper`.
5. Pin the **CSSWebScraper** extension to your toolbar and open any web page to start scraping.

### Mozilla Firefox (Gecko 109+)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."**.
3. Select `manifest.json` inside this directory.
4. The extension will be loaded with full Manifest V3 compatibility.
