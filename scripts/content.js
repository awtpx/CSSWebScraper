/**
 * CSSWebScraper - Content Script
 * Recursively inspects the DOM to extract computed fonts, normalized CSS colors, and media assets.
 */

(function () {
  'use strict';

  // Cross-Browser API Normalization
  const browserAPI = typeof chrome !== 'undefined' ? chrome : browser;

  // Prevent multiple listener registrations if script is injected multiple times
  if (window.__CSS_WEB_SCRAPER_INITIALIZED__) {
    return;
  }
  window.__CSS_WEB_SCRAPER_INITIALIZED__ = true;

  /**
   * Helper: Convert RGB / RGBA string into normalized Hex code (#RRGGBB or #RRGGBBAA).
   * Filters out transparent, rgba(0, 0, 0, 0), and invalid values.
   */
  function normalizeColorToHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;

    const trimmed = colorStr.trim().toLowerCase();
    if (trimmed === 'transparent' || trimmed === 'none' || trimmed === 'inherit' || trimmed === 'initial' || trimmed === 'unset') {
      return null;
    }

    // Match standard rgb(r, g, b) or rgba(r, g, b, a)
    // Supports comma-separated: rgb(255, 0, 85) / rgba(0, 0, 0, 0.5)
    // Supports CSS Color Module 4: rgb(255 0 85 / 0.5)
    const rgbaRegex = /^rgba?\(\s*([\d.]+)\s*(?:,|\s+)\s*([\d.]+)\s*(?:,|\s+)\s*([\d.]+)(?:\s*(?:,|\/)\s*([\d.]+%?))?\s*\)$/;
    const match = trimmed.match(rgbaRegex);

    if (match) {
      const r = Math.min(255, Math.max(0, Math.round(parseFloat(match[1]))));
      const g = Math.min(255, Math.max(0, Math.round(parseFloat(match[2]))));
      const b = Math.min(255, Math.max(0, Math.round(parseFloat(match[3]))));

      let a = 1.0;
      if (match[4] !== undefined) {
        if (match[4].endsWith('%')) {
          a = parseFloat(match[4]) / 100;
        } else {
          a = parseFloat(match[4]);
        }
      }

      // Filter out fully transparent values
      if (a <= 0.005) {
        return null;
      }

      const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();

      if (a >= 0.995) {
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      } else {
        const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
      }
    }

    // Hex fallback if already hex
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
      if (trimmed.length === 4 || trimmed.length === 5) {
        // Expand 3-digit or 4-digit hex
        const expanded = '#' + trimmed.slice(1).split('').map(ch => ch + ch).join('');
        return expanded.toUpperCase();
      }
      return trimmed.toUpperCase();
    }

    return null;
  }

  /**
   * Helper: Calculate relative luminance to classify contrast / brightness
   */
  function getLuminance(hex) {
    if (!hex || hex.length < 7) return 0.5;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Helper: Extract image URLs from CSS background-image property
   */
  function extractBackgroundImageUrls(bgStr) {
    if (!bgStr || bgStr === 'none' || bgStr === 'initial' || bgStr === 'inherit') {
      return [];
    }

    const urls = [];
    // Regex matching url(...)
    const urlPattern = /url\((?:['"]?)(.*?)(?:['"]?)\)/gi;
    let match;
    while ((match = urlPattern.exec(bgStr)) !== null) {
      const url = match[1].trim();
      if (url && !url.startsWith('data:image/svg+xml') && url !== 'none') {
        urls.push(url);
      } else if (url && url.startsWith('data:')) {
        urls.push(url);
      }
    }
    return urls;
  }

  /**
   * Helper: Resolve relative URL to absolute URL
   */
  function resolveUrl(url) {
    if (!url) return null;
    try {
      return new URL(url, document.baseURI || window.location.href).href;
    } catch (e) {
      return url;
    }
  }

  /**
   * Helper: Detect image file extension or type format
   */
  function detectImageType(url) {
    if (!url) return 'IMAGE';
    if (url.startsWith('data:image/svg')) return 'SVG';
    if (url.startsWith('data:image/png')) return 'PNG';
    if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'JPG';
    if (url.startsWith('data:image/webp')) return 'WEBP';
    if (url.startsWith('data:image/gif')) return 'GIF';
    if (url.startsWith('data:')) return 'DATA';

    const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
    if (cleanUrl.endsWith('.svg')) return 'SVG';
    if (cleanUrl.endsWith('.png')) return 'PNG';
    if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'JPG';
    if (cleanUrl.endsWith('.webp')) return 'WEBP';
    if (cleanUrl.endsWith('.gif')) return 'GIF';
    if (cleanUrl.endsWith('.avif')) return 'AVIF';
    if (cleanUrl.endsWith('.ico')) return 'ICO';
    return 'IMG';
  }

  /**
   * Main DOM Scraping Logic
   */
  function scrapePage() {
    const startTime = performance.now();

    // Map stores
    const fontFamiliesMap = new Map();
    const colorsMap = new Map();
    const mediaMap = new Map();

    const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK']);

    let totalElementsInspected = 0;

    /**
     * Recursive tree inspector
     */
    function inspectNode(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

      const tagName = node.tagName.toUpperCase();
      if (ignoredTags.has(tagName)) return;

      totalElementsInspected++;

      let computed = null;
      try {
        computed = window.getComputedStyle(node);
      } catch (e) {
        // Ignored if element detached
      }

      if (computed) {
        // ---------------------------------------------------------
        // 1. FONTS EXTRACTION
        // ---------------------------------------------------------
        const rawFamily = computed.fontFamily;
        if (rawFamily && rawFamily !== 'inherit' && rawFamily !== 'initial') {
          // Split comma-separated font stack and trim quotes
          const stack = rawFamily.split(',').map((f) => {
            return f.trim().replace(/^['"]|['"]$/g, '');
          }).filter(Boolean);

          if (stack.length > 0) {
            const primaryFamily = stack[0];
            const weight = computed.fontWeight || '400';
            const style = computed.fontStyle || 'normal';

            if (!fontFamiliesMap.has(primaryFamily)) {
              fontFamiliesMap.set(primaryFamily, {
                family: primaryFamily,
                fallbackStack: stack.slice(1).join(', ') || 'sans-serif',
                fullStack: rawFamily,
                weights: new Set(),
                styles: new Set(),
                count: 0,
                sampleText: ''
              });
            }

            const fontData = fontFamiliesMap.get(primaryFamily);
            fontData.weights.add(weight);
            fontData.styles.add(style);
            fontData.count++;

            // Grab sample text snippet if not already recorded
            if (!fontData.sampleText && node.innerText && node.innerText.trim().length > 0) {
              const snippet = node.innerText.trim().slice(0, 50);
              if (snippet.length > 2) {
                fontData.sampleText = snippet;
              }
            }
          }
        }

        // ---------------------------------------------------------
        // 2. COLORS EXTRACTION
        // ---------------------------------------------------------
        const colorProperties = [
          { prop: 'color', role: 'text' },
          { prop: 'backgroundColor', role: 'background' },
          { prop: 'borderTopColor', role: 'border' },
          { prop: 'borderRightColor', role: 'border' },
          { prop: 'borderBottomColor', role: 'border' },
          { prop: 'borderLeftColor', role: 'border' },
          { prop: 'outlineColor', role: 'border' }
        ];

        colorProperties.forEach(({ prop, role }) => {
          const rawVal = computed[prop];
          const hex = normalizeColorToHex(rawVal);
          if (hex) {
            if (!colorsMap.has(hex)) {
              colorsMap.set(hex, {
                hex: hex,
                raw: rawVal,
                count: 0,
                roles: new Set(),
                luminance: getLuminance(hex)
              });
            }
            const colorItem = colorsMap.get(hex);
            colorItem.count++;
            colorItem.roles.add(role);
          }
        });

        // SVG element fill and stroke
        if (node instanceof SVGElement || ['PATH', 'CIRCLE', 'RECT', 'POLYGON', 'LINE', 'POLYLINE', 'ELLIPSE', 'SVG'].includes(tagName)) {
          const fill = computed.fill;
          const stroke = computed.stroke;
          const hexFill = normalizeColorToHex(fill);
          const hexStroke = normalizeColorToHex(stroke);

          if (hexFill) {
            if (!colorsMap.has(hexFill)) {
              colorsMap.set(hexFill, {
                hex: hexFill,
                raw: fill,
                count: 0,
                roles: new Set(),
                luminance: getLuminance(hexFill)
              });
            }
            const item = colorsMap.get(hexFill);
            item.count++;
            item.roles.add('svg-fill');
          }

          if (hexStroke) {
            if (!colorsMap.has(hexStroke)) {
              colorsMap.set(hexStroke, {
                hex: hexStroke,
                raw: stroke,
                count: 0,
                roles: new Set(),
                luminance: getLuminance(hexStroke)
              });
            }
            const item = colorsMap.get(hexStroke);
            item.count++;
            item.roles.add('svg-stroke');
          }
        }

        // ---------------------------------------------------------
        // 3. MEDIA ASSETS: CSS BACKGROUND IMAGES
        // ---------------------------------------------------------
        const bgImages = extractBackgroundImageUrls(computed.backgroundImage);
        if (bgImages && bgImages.length > 0) {
          const rect = node.getBoundingClientRect();
          bgImages.forEach((rawUrl) => {
            const absUrl = resolveUrl(rawUrl);
            if (absUrl && !mediaMap.has(absUrl)) {
              mediaMap.set(absUrl, {
                url: absUrl,
                type: detectImageType(absUrl),
                source: 'css-background',
                width: Math.round(rect.width) || 0,
                height: Math.round(rect.height) || 0,
                alt: 'CSS Background'
              });
            }
          });
        }
      }

      // ---------------------------------------------------------
      // 4. MEDIA ASSETS: <img> TAGS
      // ---------------------------------------------------------
      if (tagName === 'IMG') {
        const src = node.currentSrc || node.src || node.getAttribute('src');
        if (src) {
          const absUrl = resolveUrl(src);
          if (absUrl) {
            const naturalW = node.naturalWidth || 0;
            const naturalH = node.naturalHeight || 0;
            const rect = node.getBoundingClientRect();
            const w = naturalW || Math.round(rect.width) || 0;
            const h = naturalH || Math.round(rect.height) || 0;

            if (!mediaMap.has(absUrl) || (mediaMap.get(absUrl).width === 0 && w > 0)) {
              mediaMap.set(absUrl, {
                url: absUrl,
                type: detectImageType(absUrl),
                source: 'img-tag',
                width: w,
                height: h,
                alt: node.alt || node.title || 'Image'
              });
            }
          }
        }
      }

      // ---------------------------------------------------------
      // 5. MEDIA ASSETS: INLINE <svg> TAGS
      // ---------------------------------------------------------
      if (tagName === 'SVG') {
        try {
          const serializer = new XMLSerializer();
          let svgString = serializer.serializeToString(node);

          // Ensure xmlns namespace exists
          if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          }

          const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
          const rect = node.getBoundingClientRect();
          const w = Math.round(rect.width) || parseInt(node.getAttribute('width')) || 32;
          const h = Math.round(rect.height) || parseInt(node.getAttribute('height')) || 32;

          // Unique key for inline SVGs
          const svgKey = `inline-svg-${mediaMap.size + 1}-${w}x${h}`;
          if (!mediaMap.has(svgKey)) {
            mediaMap.set(svgKey, {
              url: dataUri,
              type: 'SVG',
              source: 'inline-svg',
              width: w,
              height: h,
              alt: node.getAttribute('aria-label') || 'Inline SVG Icon'
            });
          }
        } catch (e) {
          // Ignore SVG serialization errors
        }
      }

      // ---------------------------------------------------------
      // 6. MEDIA ASSETS: <video poster="...">
      // ---------------------------------------------------------
      if (tagName === 'VIDEO' && node.poster) {
        const absUrl = resolveUrl(node.poster);
        if (absUrl && !mediaMap.has(absUrl)) {
          const rect = node.getBoundingClientRect();
          mediaMap.set(absUrl, {
            url: absUrl,
            type: detectImageType(absUrl),
            source: 'video-poster',
            width: Math.round(rect.width) || 0,
            height: Math.round(rect.height) || 0,
            alt: 'Video Poster'
          });
        }
      }

      // Traverse children recursively
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        inspectNode(children[i]);
      }

      // Traverse Shadow DOM if present
      if (node.shadowRoot) {
        const shadowChildren = node.shadowRoot.children;
        for (let i = 0; i < shadowChildren.length; i++) {
          inspectNode(shadowChildren[i]);
        }
      }
    }

    // Begin recursion from document root
    if (document.documentElement) {
      inspectNode(document.documentElement);
    }

    // Format Fonts output
    const fonts = Array.from(fontFamiliesMap.values()).map((item) => ({
      family: item.family,
      fallbackStack: item.fallbackStack,
      fullStack: item.fullStack,
      weights: Array.from(item.weights).sort((a, b) => parseInt(a) - parseInt(b)),
      styles: Array.from(item.styles),
      count: item.count,
      sampleText: item.sampleText || 'The quick brown fox jumps over the lazy dog'
    })).sort((a, b) => b.count - a.count);

    // Format Colors output
    const colors = Array.from(colorsMap.values()).map((item) => ({
      hex: item.hex,
      raw: item.raw,
      count: item.count,
      roles: Array.from(item.roles),
      luminance: item.luminance
    })).sort((a, b) => b.count - a.count);

    // Format Images output
    const images = Array.from(mediaMap.values());

    const duration = Math.round(performance.now() - startTime);

    return {
      success: true,
      url: window.location.href,
      title: document.title || window.location.hostname,
      hostname: window.location.hostname,
      stats: {
        totalElements: totalElementsInspected,
        fontFamiliesCount: fonts.length,
        colorsCount: colors.length,
        imagesCount: images.length,
        scanDurationMs: duration
      },
      fonts: fonts,
      colors: colors,
      images: images
    };
  }

  // Cross-browser message listener
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.action === 'SCRAPE_PAGE') {
      try {
        const payload = scrapePage();
        sendResponse(payload);
      } catch (err) {
        sendResponse({
          success: false,
          error: err.message || 'Error occurred while scraping DOM tree.'
        });
      }
      return true; // Keep message channel open for async response if needed
    }

    if (request && request.action === 'PING') {
      sendResponse({ status: 'READY' });
      return true;
    }
  });

})();
