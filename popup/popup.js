/**
 * CSSWebScraper - Popup Controller
 * Manages UI interactions, live color code preview, typographic font specimens,
 * data fetching, filtering, color export, and media downloads.
 */

// Cross-Browser API Normalization
const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;

// Application State
const state = {
  currentTab: 'tab-fonts',
  data: null,
  activeTabInfo: null,
  isLoading: true,
  selectedImages: new Set(),
  colorFilter: 'all',
  mediaFilter: 'all',
  fontsSearchQuery: '',
  fontsPreviewText: 'The quick brown fox jumps over the lazy dog',
  fontsPreviewSize: '14',
  activeColorPreview: null,
  activeFontSpecimen: null,
  specimenCurrentWeight: '400'
};

// DOM Elements Map
const elements = {
  pageHeading: document.getElementById('page-heading'),
  statsBadge: document.getElementById('stats-badge'),
  toast: document.getElementById('toast'),
  loadingOverlay: document.getElementById('loading-overlay'),
  errorOverlay: document.getElementById('error-overlay'),
  errorMessage: document.getElementById('error-message'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnErrorRetry: document.getElementById('btn-error-retry'),
  btnGithub: document.getElementById('btn-github'),

  // Navigation
  navButtons: document.querySelectorAll('.nav-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),

  // Fonts Tab
  fontsSearch: document.getElementById('fonts-search'),
  fontsSearchClear: document.getElementById('fonts-search-clear'),
  fontsPreviewTextInput: document.getElementById('fonts-preview-text'),
  fontSizeChips: document.querySelectorAll('[data-font-size]'),
  fontsListContainer: document.getElementById('fonts-list-container'),

  // CSS Tab
  btnExportRoot: document.getElementById('btn-export-root'),
  colorChips: document.querySelectorAll('[data-color-filter]'),
  colorsListContainer: document.getElementById('colors-list-container'),

  // Images Tab
  btnSelectAllImages: document.getElementById('btn-select-all-images'),
  btnDownloadSelected: document.getElementById('btn-download-selected'),
  downloadBtnText: document.getElementById('download-btn-text'),
  mediaChips: document.querySelectorAll('[data-media-filter]'),
  imagesListContainer: document.getElementById('images-list-container'),

  // Color Preview Modal Elements
  modalColorPreview: document.getElementById('modal-color-preview'),
  btnCloseColorModal: document.getElementById('btn-close-color-modal'),
  colorPreviewHexTitle: document.getElementById('color-preview-hex'),
  colorHeroSwatch: document.getElementById('color-hero-swatch'),
  colorHeroContrastText: document.getElementById('color-hero-contrast-text'),
  colorValHex: document.getElementById('color-val-hex'),
  colorValRgb: document.getElementById('color-val-rgb'),
  colorValHsl: document.getElementById('color-val-hsl'),
  sandboxBtnPreview: document.getElementById('sandbox-btn-preview'),
  sandboxBadgePreview: document.getElementById('sandbox-badge-preview'),
  sandboxTextLight: document.getElementById('sandbox-text-light'),
  sandboxTextDark: document.getElementById('sandbox-text-dark'),
  wcagWhiteBadge: document.getElementById('wcag-white-badge'),
  wcagWhiteRatio: document.getElementById('wcag-white-ratio'),
  wcagBlackBadge: document.getElementById('wcag-black-badge'),
  wcagBlackRatio: document.getElementById('wcag-black-ratio'),

  // Font Specimen Modal Elements
  modalFontSpecimen: document.getElementById('modal-font-specimen'),
  btnCloseFontModal: document.getElementById('btn-close-font-modal'),
  fontSpecimenFamilyTitle: document.getElementById('font-specimen-family'),
  specimenCustomInput: document.getElementById('specimen-custom-input'),
  specimenWeightsContainer: document.getElementById('specimen-weights-container'),
  specimenHero: document.getElementById('specimen-hero'),
  specimenWaterfall: document.getElementById('specimen-waterfall'),
  specimenScale: document.getElementById('specimen-scale')
};

// ============================================================================
// Mathematical Color & WCAG Helpers
// ============================================================================

/**
 * Convert Hex code (#RGB, #RRGGBB, #RRGGBBAA) to RGB object
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0, a: 1 };
  let c = hex.replace('#', '').trim();
  if (c.length === 3 || c.length === 4) {
    c = c.split('').map(x => x + x).join('');
  }
  const r = parseInt(c.slice(0, 2), 16) || 0;
  const g = parseInt(c.slice(2, 4), 16) || 0;
  const b = parseInt(c.slice(4, 6), 16) || 0;
  let a = 1.0;
  if (c.length === 8) {
    a = Math.round((parseInt(c.slice(6, 8), 16) / 255) * 100) / 100;
  }
  return { r, g, b, a };
}

/**
 * Convert RGB values to HSL string
 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
  }
  return `hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/**
 * WCAG 2.1 relative luminance calculation
 */
function getRelativeLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/**
 * WCAG 2.1 Contrast Ratio between two hex colors
 */
function getContrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 10) / 10;
}

/**
 * Determine best contrast text color (black or white) for a background hex
 */
function getBestContrastTextColor(hex) {
  const ratioWhite = getContrastRatio(hex, '#FFFFFF');
  const ratioBlack = getContrastRatio(hex, '#000000');
  return ratioWhite >= ratioBlack ? '#FFFFFF' : '#000000';
}

// ============================================================================
// UI Toast & Clipboard Helpers
// ============================================================================

let toastTimeout = null;
function showToast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, 2200);
}

async function copyToClipboard(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage || 'COPIED TO CLIPBOARD!');
  } catch (err) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(successMessage || 'COPIED TO CLIPBOARD!');
  }
}

function isInspectableUrl(url) {
  if (!url) return false;
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'view-source:', 'devtools:'];
  return !restrictedProtocols.some(proto => url.startsWith(proto));
}

// ============================================================================
// Color Code Preview & Inspector Modal Controller
// ============================================================================

function openColorPreview(colorItem) {
  state.activeColorPreview = colorItem;
  const hex = colorItem.hex;
  const rgbObj = hexToRgb(hex);
  const rgbString = rgbObj.a < 1 ? `rgba(${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b}, ${rgbObj.a})` : `rgb(${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b})`;
  const hslString = rgbToHsl(rgbObj.r, rgbObj.g, rgbObj.b);

  // Set Titles & Codes
  elements.colorPreviewHexTitle.textContent = hex;
  elements.colorValHex.textContent = hex;
  elements.colorValRgb.textContent = rgbString;
  elements.colorValHsl.textContent = hslString;

  // Set Hero Swatch
  elements.colorHeroSwatch.style.backgroundColor = hex;
  const bestText = getBestContrastTextColor(hex);
  elements.colorHeroContrastText.style.color = bestText;
  elements.colorHeroContrastText.style.backgroundColor = bestText === '#FFFFFF' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
  elements.colorHeroContrastText.style.border = `1px solid ${bestText}`;

  // Live UI Component Previews
  // 1. Solid Button
  elements.sandboxBtnPreview.style.backgroundColor = hex;
  elements.sandboxBtnPreview.style.color = bestText;

  // 2. Pill Badge
  elements.sandboxBadgePreview.style.backgroundColor = hex;
  elements.sandboxBadgePreview.style.color = bestText;

  // 3. Text on Light
  elements.sandboxTextLight.style.color = hex;

  // 4. Text on Dark
  elements.sandboxTextDark.style.color = hex;

  // WCAG Contrast Matrix
  const whiteRatio = getContrastRatio(hex, '#FFFFFF');
  elements.wcagWhiteRatio.textContent = `${whiteRatio} : 1`;
  if (whiteRatio >= 7.0) {
    elements.wcagWhiteBadge.textContent = 'AAA PASS';
    elements.wcagWhiteBadge.className = 'wcag-badge pass';
  } else if (whiteRatio >= 4.5) {
    elements.wcagWhiteBadge.textContent = 'AA PASS';
    elements.wcagWhiteBadge.className = 'wcag-badge pass';
  } else {
    elements.wcagWhiteBadge.textContent = 'FAIL';
    elements.wcagWhiteBadge.className = 'wcag-badge fail';
  }

  const blackRatio = getContrastRatio(hex, '#000000');
  elements.wcagBlackRatio.textContent = `${blackRatio} : 1`;
  if (blackRatio >= 7.0) {
    elements.wcagBlackBadge.textContent = 'AAA PASS';
    elements.wcagBlackBadge.className = 'wcag-badge pass';
  } else if (blackRatio >= 4.5) {
    elements.wcagBlackBadge.textContent = 'AA PASS';
    elements.wcagBlackBadge.className = 'wcag-badge pass';
  } else {
    elements.wcagBlackBadge.textContent = 'FAIL';
    elements.wcagBlackBadge.className = 'wcag-badge fail';
  }

  elements.modalColorPreview.classList.remove('hidden');
}

function closeColorPreview() {
  elements.modalColorPreview.classList.add('hidden');
  state.activeColorPreview = null;
}

// ============================================================================
// Font Specimen & Inspector Modal Controller
// ============================================================================

function openFontSpecimen(fontItem) {
  state.activeFontSpecimen = fontItem;
  state.specimenCurrentWeight = fontItem.weights[0] || '400';

  elements.fontSpecimenFamilyTitle.textContent = fontItem.family;
  elements.specimenCustomInput.value = state.fontsPreviewText;

  // Render clickable weight pills
  elements.specimenWeightsContainer.innerHTML = '';
  fontItem.weights.forEach(w => {
    const btn = document.createElement('button');
    btn.className = `specimen-weight-btn ${w === state.specimenCurrentWeight ? 'active' : ''}`;
    btn.textContent = formatWeight(w);
    btn.addEventListener('click', () => {
      state.specimenCurrentWeight = w;
      document.querySelectorAll('.specimen-weight-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSpecimenRender();
    });
    elements.specimenWeightsContainer.appendChild(btn);
  });

  updateSpecimenRender();
  elements.modalFontSpecimen.classList.remove('hidden');
}

function updateSpecimenRender() {
  if (!state.activeFontSpecimen) return;
  const font = state.activeFontSpecimen;
  const text = elements.specimenCustomInput.value || 'The quick brown fox jumps over the lazy dog';
  const weight = state.specimenCurrentWeight;

  elements.specimenHero.style.fontFamily = font.fullStack;
  elements.specimenHero.style.fontWeight = weight;
  elements.specimenHero.textContent = text;

  elements.specimenWaterfall.style.fontFamily = font.fullStack;
  elements.specimenWaterfall.style.fontWeight = weight;

  elements.specimenScale.style.fontFamily = font.fullStack;
}

function closeFontSpecimen() {
  elements.modalFontSpecimen.classList.add('hidden');
  state.activeFontSpecimen = null;
}

// ============================================================================
// Data Inspection & Injection Pipeline
// ============================================================================

async function inspectCurrentTab() {
  setLoading(true);
  hideError();

  try {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      showError('No active browser tab found.');
      return;
    }

    const activeTab = tabs[0];
    state.activeTabInfo = activeTab;

    if (!isInspectableUrl(activeTab.url)) {
      showError('Browser extensions cannot inspect internal browser pages (e.g. chrome://, about:). Please open an HTTP or HTTPS web page.');
      return;
    }

    let response;
    try {
      response = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'SCRAPE_PAGE' });
    } catch (e) {
      // Content script fallback injection
      try {
        await browserAPI.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['scripts/content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 80));
        response = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'SCRAPE_PAGE' });
      } catch (injectionError) {
        showError('Unable to inspect page: ' + (injectionError.message || 'Script injection restricted.'));
        return;
      }
    }

    if (response && response.success) {
      state.data = response;
      renderAll();
    } else {
      showError(response ? response.error : 'Failed to retrieve page styles.');
    }
  } catch (err) {
    showError(err.message || 'An unexpected error occurred.');
  } finally {
    setLoading(false);
  }
}

function setLoading(loading) {
  state.isLoading = loading;
  if (loading) {
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    elements.loadingOverlay.classList.add('hidden');
  }
}

function showError(msg) {
  elements.errorMessage.textContent = msg || 'Could not inspect this page.';
  elements.errorOverlay.classList.remove('hidden');
  elements.loadingOverlay.classList.add('hidden');
}

function hideError() {
  elements.errorOverlay.classList.add('hidden');
}

function updateHeader() {
  if (!state.data) {
    elements.statsBadge.textContent = '0 DETECTED';
    return;
  }

  const { fonts, colors, images } = state.data;

  if (state.currentTab === 'tab-fonts') {
    elements.pageHeading.textContent = 'Fonts';
    elements.statsBadge.textContent = `${fonts.length} FAMILIES`;
  } else if (state.currentTab === 'tab-css') {
    elements.pageHeading.textContent = 'CSS';
    elements.statsBadge.textContent = `${colors.length} COLORS`;
  } else if (state.currentTab === 'tab-images') {
    elements.pageHeading.textContent = 'Images';
    elements.statsBadge.textContent = `${images.length} ASSETS`;
  }
}

function switchTab(targetTabId) {
  state.currentTab = targetTabId;

  elements.navButtons.forEach(btn => {
    if (btn.dataset.tab === targetTabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  elements.tabPanes.forEach(pane => {
    if (pane.id === targetTabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  updateHeader();
}

function formatWeight(w) {
  const weightMap = {
    '100': 'Thin',
    '200': 'ExtraLight',
    '300': 'Light',
    '400': 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    '800': 'ExtraBold',
    '900': 'Black'
  };
  return weightMap[w] ? `${w} (${weightMap[w]})` : w;
}

// ============================================================================
// Render: Tab 1 - Fonts
// ============================================================================

function renderFonts() {
  const container = elements.fontsListContainer;
  container.innerHTML = '';

  if (!state.data || !state.data.fonts || state.data.fonts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO FONTS DETECTED</div>
        <div class="empty-desc">No rendered font families were detected on this page.</div>
      </div>
    `;
    return;
  }

  const query = state.fontsSearchQuery.toLowerCase().trim();
  const filteredFonts = state.data.fonts.filter(f => {
    return f.family.toLowerCase().includes(query) || f.fallbackStack.toLowerCase().includes(query);
  });

  if (filteredFonts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO MATCHING FONTS</div>
        <div class="empty-desc">No font families match your search query "${escapeHtml(state.fontsSearchQuery)}".</div>
      </div>
    `;
    return;
  }

  const previewText = state.fontsPreviewText || 'The quick brown fox jumps over the lazy dog';
  const previewSize = state.fontsPreviewSize || '14';

  filteredFonts.forEach(font => {
    const card = document.createElement('div');
    card.className = 'font-card';

    // Interactive weights (click to preview that specific weight in-card!)
    const weightBadges = font.weights.map((w, i) => {
      return `<button class="spec-badge weight ${i === 0 ? 'active' : ''}" data-weight="${w}" title="Click to preview ${w}">${formatWeight(w)}</button>`;
    }).join('');

    const styleBadges = font.styles.map(s => `<span class="spec-badge style">${s}</span>`).join('');

    card.innerHTML = `
      <div class="font-card-header">
        <div>
          <h3 class="font-family-title">${escapeHtml(font.family)}</h3>
          <div class="font-fallback">Fallback: ${escapeHtml(font.fallbackStack)}</div>
        </div>
        <span class="font-count-badge">${font.count} el</span>
      </div>

      <div class="font-specs">
        ${weightBadges}
        ${styleBadges}
      </div>

      <div class="font-preview-box" style="font-family: ${escapeHtml(font.fullStack)}; font-size: ${previewSize}px; font-weight: ${font.weights[0] || '400'};">
        ${escapeHtml(previewText)}
      </div>

      <div class="font-card-actions">
        <button class="btn btn-secondary btn-sm btn-specimen-font">
          Preview Specimen
        </button>
        <button class="btn btn-secondary btn-sm btn-copy-font" data-family="${escapeHtml(font.family)}" data-stack="${escapeHtml(font.fullStack)}">
          Copy CSS
        </button>
      </div>
    `;

    const previewBox = card.querySelector('.font-preview-box');

    // Weight pills click interactivity
    const weightButtons = card.querySelectorAll('.spec-badge.weight');
    weightButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        weightButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        previewBox.style.fontWeight = btn.dataset.weight;
      });
    });

    // Preview Specimen button
    const specimenBtn = card.querySelector('.btn-specimen-font');
    specimenBtn.addEventListener('click', () => {
      openFontSpecimen(font);
    });

    // Copy CSS button
    const copyBtn = card.querySelector('.btn-copy-font');
    copyBtn.addEventListener('click', () => {
      const cssString = `font-family: ${font.fullStack};`;
      copyToClipboard(cssString, `COPIED: ${font.family}`);
    });

    container.appendChild(card);
  });
}

// ============================================================================
// Render: Tab 2 - CSS Colors
// ============================================================================

function renderColors() {
  const container = elements.colorsListContainer;
  container.innerHTML = '';

  if (!state.data || !state.data.colors || state.data.colors.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO COLORS DETECTED</div>
        <div class="empty-desc">No computed color properties were found on this page.</div>
      </div>
    `;
    return;
  }

  const filter = state.colorFilter;
  const filteredColors = state.data.colors.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'text') return c.roles.includes('text');
    if (filter === 'background') return c.roles.includes('background');
    if (filter === 'border') return c.roles.includes('border');
    return true;
  });

  if (filteredColors.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO COLORS IN THIS CATEGORY</div>
        <div class="empty-desc">Try selecting another filter above.</div>
      </div>
    `;
    return;
  }

  filteredColors.forEach(color => {
    const card = document.createElement('div');
    card.className = 'color-card';
    card.title = `Click to preview & inspect ${color.hex}`;

    const roleBadges = color.roles.map(r => `<span class="role-tag">${escapeHtml(r)}</span>`).join('');
    const bestTextColor = getBestContrastTextColor(color.hex);

    card.innerHTML = `
      <div class="color-swatch-wrapper">
        <div class="color-swatch-fill" style="background-color: ${color.hex};"></div>
        <span class="color-swatch-preview-label" style="color: ${bestTextColor}; border: 1.5px solid ${bestTextColor};">Aa</span>
        <div class="color-swatch-copy-hint">INSPECT &amp; PREVIEW</div>
      </div>
      <div class="color-info">
        <div class="color-hex-row">
          <span class="color-hex">${color.hex}</span>
          <span class="color-count">${color.count}x</span>
        </div>
        <div class="color-card-bottom-row">
          <div class="color-roles">
            ${roleBadges}
          </div>
          <button class="btn-inspect-color" title="Preview in UI Sandbox">Preview</button>
        </div>
      </div>
    `;

    // Click anywhere on card or preview button opens Color Code Preview Modal
    card.addEventListener('click', () => {
      openColorPreview(color);
    });

    container.appendChild(card);
  });
}

function exportToRoot() {
  if (!state.data || !state.data.colors || state.data.colors.length === 0) {
    showToast('NO COLORS AVAILABLE');
    return;
  }

  const lines = [':root {'];
  state.data.colors.forEach((color, idx) => {
    const varName = `--color-${idx + 1}`;
    const comment = `/* ${color.roles.join(', ')} (${color.count}x) */`;
    lines.push(`  ${varName}: ${color.hex}; ${comment}`);
  });
  lines.push('}');

  const cssContent = lines.join('\n');
  copyToClipboard(cssContent, 'COPIED :root PALETTE!');

  try {
    const blob = new Blob([cssContent], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const domain = state.activeTabInfo && state.activeTabInfo.url ? new URL(state.activeTabInfo.url).hostname.replace(/[^a-z0-9]/gi, '_') : 'palette';
    browserAPI.downloads.download({
      url: url,
      filename: `csswebscraper-${domain}-palette.css`,
      saveAs: false
    });
  } catch (e) {}
}

// ============================================================================
// Render: Tab 3 - Media Assets
// ============================================================================

function renderImages() {
  const container = elements.imagesListContainer;
  container.innerHTML = '';

  if (!state.data || !state.data.images || state.data.images.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO MEDIA ASSETS FOUND</div>
        <div class="empty-desc">No &lt;img&gt; tags, inline SVGs, or CSS background images were detected.</div>
      </div>
    `;
    updateDownloadBtn();
    return;
  }

  const filter = state.mediaFilter;
  const filteredImages = state.data.images.filter(img => {
    if (filter === 'all') return true;
    if (filter === 'SVG') return img.type === 'SVG';
    if (filter === 'RASTER') return ['PNG', 'JPG', 'WEBP', 'GIF', 'AVIF'].includes(img.type);
    if (filter === 'CSS') return img.source === 'css-background';
    return true;
  });

  if (filteredImages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">NO ASSETS IN THIS FILTER</div>
        <div class="empty-desc">No media matches category "${filter}".</div>
      </div>
    `;
    updateDownloadBtn();
    return;
  }

  filteredImages.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    if (state.selectedImages.has(img.url)) {
      card.classList.add('selected');
    }

    const dims = img.width && img.height ? `${img.width}×${img.height}` : 'N/A';
    const isSvg = img.type === 'SVG';
    const filenameEstimate = getFileNameFromUrl(img.url, idx, img.type);

    card.innerHTML = `
      <input type="checkbox" class="image-card-checkbox" data-url="${escapeHtml(img.url)}" ${state.selectedImages.has(img.url) ? 'checked' : ''} title="Select for download">
      <div class="image-thumb-wrapper">
        <img class="image-thumb" src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt)}" loading="lazy">
      </div>
      <div class="image-card-details">
        <div class="image-badges-row">
          <span class="media-format-badge ${isSvg ? 'svg' : ''}">${escapeHtml(img.type)}</span>
          <span class="media-dimensions">${dims}</span>
        </div>
        <div class="image-title-text" title="${escapeHtml(filenameEstimate)}">${escapeHtml(filenameEstimate)}</div>
        <div class="image-actions-row">
          <button class="btn btn-secondary btn-sm btn-img-download" data-url="${escapeHtml(img.url)}" data-filename="${escapeHtml(filenameEstimate)}" title="Download Asset">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save
          </button>
          <button class="btn btn-secondary btn-sm btn-icon-only btn-img-open" data-url="${escapeHtml(img.url)}" title="Open in New Tab">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    const thumbImg = card.querySelector('.image-thumb');
    thumbImg.addEventListener('error', () => {
      thumbImg.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.style.fontSize = '10px';
      placeholder.style.fontWeight = '700';
      placeholder.style.color = '#888';
      placeholder.textContent = '[PREVIEW N/A]';
      card.querySelector('.image-thumb-wrapper').appendChild(placeholder);
    });

    const checkbox = card.querySelector('.image-card-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        state.selectedImages.add(img.url);
        card.classList.add('selected');
      } else {
        state.selectedImages.delete(img.url);
        card.classList.remove('selected');
      }
      updateDownloadBtn();
    });

    const downloadBtn = card.querySelector('.btn-img-download');
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadSingleImage(img.url, filenameEstimate);
    });

    const openBtn = card.querySelector('.btn-img-open');
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      browserAPI.tabs.create({ url: img.url });
    });

    container.appendChild(card);
  });

  updateDownloadBtn();
}

function getFileNameFromUrl(url, index, type) {
  if (url.startsWith('data:image/svg')) {
    return `vector-icon-${index + 1}.svg`;
  }
  if (url.startsWith('data:')) {
    const ext = type ? type.toLowerCase() : 'png';
    return `asset-${index + 1}.${ext}`;
  }

  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      return lastPart.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
  } catch (e) {}

  const ext = type ? type.toLowerCase() : 'png';
  return `image-${index + 1}.${ext}`;
}

function downloadSingleImage(url, filename) {
  try {
    browserAPI.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    }, () => {
      if (browserAPI.runtime.lastError) {
        showToast('DOWNLOAD FAILED');
      } else {
        showToast(`DOWNLOADED ${filename}`);
      }
    });
  } catch (e) {
    showToast('DOWNLOAD ERROR: ' + e.message);
  }
}

async function downloadSelectedImages() {
  if (!state.data || !state.data.images || state.data.images.length === 0) {
    showToast('NO IMAGES TO DOWNLOAD');
    return;
  }

  let targets = [];
  if (state.selectedImages.size > 0) {
    targets = state.data.images.filter(img => state.selectedImages.has(img.url));
  } else {
    targets = state.data.images;
  }

  if (targets.length === 0) {
    showToast('NO IMAGES SELECTED');
    return;
  }

  showToast(`DOWNLOADING ${targets.length} ASSETS...`);

  const domain = state.activeTabInfo && state.activeTabInfo.url ? new URL(state.activeTabInfo.url).hostname.replace(/[^a-z0-9]/gi, '_') : 'site';

  for (let i = 0; i < targets.length; i++) {
    const img = targets[i];
    const baseName = getFileNameFromUrl(img.url, i, img.type);
    const subfolderFilename = `csswebscraper/${domain}/${baseName}`;

    try {
      browserAPI.downloads.download({
        url: img.url,
        filename: subfolderFilename,
        saveAs: false
      });
    } catch (err) {
      console.warn('Download error on asset', img.url, err);
    }

    if (i < targets.length - 1) {
      await new Promise(r => setTimeout(r, 120));
    }
  }
}

function updateDownloadBtn() {
  const count = state.selectedImages.size;
  if (count > 0) {
    elements.downloadBtnText.textContent = `Download (${count})`;
    elements.btnSelectAllImages.textContent = 'Deselect All';
  } else {
    const total = state.data && state.data.images ? state.data.images.length : 0;
    elements.downloadBtnText.textContent = `Download All (${total})`;
    elements.btnSelectAllImages.textContent = 'Select All';
  }
}

function renderAll() {
  updateHeader();
  renderFonts();
  renderColors();
  renderImages();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Event Listeners Setup
// ============================================================================

function setupEventListeners() {
  // Navigation tabs
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Refresh
  elements.btnRefresh.addEventListener('click', () => {
    inspectCurrentTab();
  });

  // Retry
  elements.btnErrorRetry.addEventListener('click', () => {
    inspectCurrentTab();
  });

  // GitHub Link
  elements.btnGithub.addEventListener('click', (e) => {
    e.preventDefault();
    browserAPI.tabs.create({ url: 'https://github.com/awtpx/CSSWebScraper' });
  });

  // Fonts Search
  elements.fontsSearch.addEventListener('input', (e) => {
    state.fontsSearchQuery = e.target.value;
    if (state.fontsSearchQuery.length > 0) {
      elements.fontsSearchClear.classList.add('visible');
    } else {
      elements.fontsSearchClear.classList.remove('visible');
    }
    renderFonts();
  });

  elements.fontsSearchClear.addEventListener('click', () => {
    elements.fontsSearch.value = '';
    state.fontsSearchQuery = '';
    elements.fontsSearchClear.classList.remove('visible');
    renderFonts();
  });

  // Live Font Preview Custom Text Input
  elements.fontsPreviewTextInput.addEventListener('input', (e) => {
    state.fontsPreviewText = e.target.value;
    document.querySelectorAll('.font-preview-box').forEach(box => {
      box.textContent = state.fontsPreviewText || 'The quick brown fox jumps over the lazy dog';
    });
  });

  // Live Font Preview Size Chips
  elements.fontSizeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.fontSizeChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.fontsPreviewSize = chip.dataset.fontSize;
      document.querySelectorAll('.font-preview-box').forEach(box => {
        box.style.fontSize = `${state.fontsPreviewSize}px`;
      });
    });
  });

  // Color Preview Modal Close
  elements.btnCloseColorModal.addEventListener('click', () => {
    closeColorPreview();
  });

  elements.modalColorPreview.addEventListener('click', (e) => {
    if (e.target === elements.modalColorPreview) {
      closeColorPreview();
    }
  });

  // Color Preview Format Copy buttons
  document.querySelectorAll('.btn-copy-format').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.dataset.format;
      let textToCopy = '';
      if (format === 'hex') textToCopy = elements.colorValHex.textContent;
      if (format === 'rgb') textToCopy = elements.colorValRgb.textContent;
      if (format === 'hsl') textToCopy = elements.colorValHsl.textContent;
      copyToClipboard(textToCopy, `COPIED ${format.toUpperCase()}: ${textToCopy}`);
    });
  });

  // Font Specimen Modal Close
  elements.btnCloseFontModal.addEventListener('click', () => {
    closeFontSpecimen();
  });

  elements.modalFontSpecimen.addEventListener('click', (e) => {
    if (e.target === elements.modalFontSpecimen) {
      closeFontSpecimen();
    }
  });

  // Font Specimen Custom Input
  elements.specimenCustomInput.addEventListener('input', () => {
    updateSpecimenRender();
  });

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeColorPreview();
      closeFontSpecimen();
    }
  });

  // Export to :root CSS variables
  elements.btnExportRoot.addEventListener('click', () => {
    exportToRoot();
  });

  // Color Filter Chips
  elements.colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.colorChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.colorFilter = chip.dataset.colorFilter;
      renderColors();
    });
  });

  // Media Filter Chips
  elements.mediaChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.mediaChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.mediaFilter = chip.dataset.mediaFilter;
      renderImages();
    });
  });

  // Select / Deselect All Images
  elements.btnSelectAllImages.addEventListener('click', () => {
    if (!state.data || !state.data.images) return;

    if (state.selectedImages.size > 0) {
      state.selectedImages.clear();
    } else {
      state.data.images.forEach(img => state.selectedImages.add(img.url));
    }
    renderImages();
  });

  // Download Selected / All
  elements.btnDownloadSelected.addEventListener('click', () => {
    downloadSelectedImages();
  });
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  inspectCurrentTab();
});
