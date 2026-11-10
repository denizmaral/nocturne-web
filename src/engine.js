// Nocturne Web engine: darkens a page without touching the page's own styles.
//
// For every stylesheet on the page it builds a dark copy of each colour declaration and
// puts the copies in one extra stylesheet. Copies keep the original selectors (prefixed with
// a gate on <html>), !important and order, so they win over the originals exactly where the
// originals won before. Removing the gate attribute restores the page instantly.
//
// Colours: light backgrounds -> dark, dark text -> light, hue and chroma kept (see color.js).
"use strict";

(function (root) {
  const { Color, parseColor, NAMED, KEYWORDS } = root.NocturneColor;

  const GATE_ATTR = "data-nocturne-web";
  const GATE = `html[${GATE_ATTR}]`;
  const ID_ATTR = "data-nw-id";
  const FIX_ATTR = "data-nw-fix";
  const STYLE_ID = "nocturne-web";
  const DYNAMIC_ID = "nocturne-web-elements";

  // Longhands we darken, and the role of their colours.
  const ROLE = {
    "color": "text", "-webkit-text-fill-color": "text", "text-decoration-color": "text", "caret-color": "text",
    "text-emphasis-color": "text", "fill": "text", "stroke": "text",
    "background-color": "bg", "background-image": "bg", "box-shadow": "bg", "outline-color": "bg", "column-rule-color": "bg",
    "border-top-color": "bg", "border-right-color": "bg", "border-bottom-color": "bg", "border-left-color": "bg",
    "border-block-start-color": "bg", "border-block-end-color": "bg", "border-inline-start-color": "bg", "border-inline-end-color": "bg",
  };
  // When a shorthand contains var(), the CSSOM only exposes the shorthand's text.
  const SHORTHANDS = [
    ["background", "bg"], ["border", "bg"], ["border-color", "bg"], ["border-top", "bg"], ["border-right", "bg"],
    ["border-bottom", "bg"], ["border-left", "bg"], ["border-block", "bg"], ["border-inline", "bg"],
    ["border-block-start", "bg"], ["border-block-end", "bg"], ["border-inline-start", "bg"], ["border-inline-end", "bg"],
    ["outline", "bg"], ["column-rule", "bg"], ["text-decoration", "text"],
  ];
  const PREFIX = { bg: "--nw-bg-", text: "--nw-fg-" };

  const BASE = `${GATE}{color-scheme:dark;color:#ebebeb;background-color:#1a1a1a}`
    + `:where(${GATE}) :where(a:link){color:#8ab4f8}:where(${GATE}) :where(a:visited){color:#c58af9}`;

  // ---------------------------------------------------------------------------------------
  // Values

  const cache = new Map();

  /** Dark version of a colour value for a role, or null to drop the copy. */
  function convertValue(value, role) {
    const key = role + "|" + value;
    if (cache.has(key)) return cache.get(key);
    let out;
    const v = value.trim();
    const lower = v.toLowerCase();
    if (KEYWORDS.has(lower) || lower.startsWith("light-dark(")) {
      out = v;  // light-dark() follows the dark colour-scheme by itself
    } else {
      const c = lower.includes("var(") ? null : parseColor(v);
      out = c ? c.adjusted(role).css() : rewriteTokens(v, role);
    }
    if (cache.size > 20000) cache.clear();
    cache.set(key, out);
    return out;
  }

  /** Index just past the ")" matching the "(" at `open`. */
  function closingParen(s, open) {
    let depth = 0, quote = null;
    for (let i = open; i < s.length; i++) {
      const ch = s[i];
      if (quote) { if (ch === quote && s[i - 1] !== "\\") quote = null; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) return i + 1;
    }
    return s.length;
  }

  function splitTopLevel(s, sep) {
    const parts = [];
    let depth = 0, quote = null, start = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") depth = Math.max(0, depth - 1);
      else if (ch === sep && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
    }
    parts.push(s.slice(start));
    return parts;
  }

  const COLOR_FN = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
  const TOKEN = /url\(|var\(|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color|light-dark)\(|#[0-9a-f]+\b|[a-z_-][a-z0-9_-]*|"[^"]*"|'[^']*'/iy;

  /**
   * Rewrites every colour inside a value such as a gradient, a shadow or a border shorthand,
   * and points var() references at their dark twins. Returns null if it meets a colour
   * function it can't convert.
   */
  function rewriteTokens(value, role) {
    let out = "", i = 0;
    while (i < value.length) {
      TOKEN.lastIndex = i;
      const m = TOKEN.exec(value);
      if (!m) { out += value[i++]; continue; }
      const tok = m[0], lower = tok.toLowerCase();
      if (lower === "url(" || lower === "light-dark(") {
        const end = closingParen(value, i + tok.length - 1);
        out += value.slice(i, end); i = end; continue;
      }
      if (lower === "var(") {
        const end = closingParen(value, i + 3);
        const inner = value.slice(i + 4, end - 1);
        const [name, ...rest] = splitTopLevel(inner, ",");
        const fallback = rest.length ? rest.join(",") : null;
        const n = name.trim();
        let fb = "";
        if (fallback !== null) {
          const conv = rewriteTokens(fallback, role);
          fb = "," + (conv === null ? fallback : conv);
        }
        out += n.startsWith("--") ? `var(${PREFIX[role]}${n.slice(2)},var(${n}${fb}))` : value.slice(i, end);
        i = end; continue;
      }
      if (tok.endsWith("(")) {  // a colour function
        const end = closingParen(value, i + tok.length - 1);
        const whole = value.slice(i, end);
        if (/var\(/i.test(whole)) {
          const inner = rewriteTokens(whole.slice(tok.length, -1), role);
          if (inner === null) return null;
          out += tok + inner + ")";
        } else {
          const c = parseColor(whole);
          if (!c) return null;
          out += c.adjusted(role).css();
        }
        i = end; continue;
      }
      if (tok[0] === "#") {
        const c = parseColor(tok);
        out += c ? c.adjusted(role).css() : tok;  // a malformed hex is invalid CSS anyway
        i += tok.length; continue;
      }
      if (Object.prototype.hasOwnProperty.call(NAMED, lower) && value[i + tok.length] !== "(") {
        out += parseColor(tok).adjusted(role).css();
        i += tok.length; continue;
      }
      out += tok; i += tok.length;
    }
    return out;
  }

  const RGB_CHANNELS = /^(\d{1,3}(?:\.\d+)?)(\s*,\s*|\s+)(\d{1,3}(?:\.\d+)?)\2(\d{1,3}(?:\.\d+)?)$/;
  const HSL_CHANNELS = /^(-?\d+(?:\.\d+)?)(deg)?(\s*,\s*|\s+)(\d+(?:\.\d+)?)%\3(\d+(?:\.\d+)?)%$/;
  const COLORISH = /var\(|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
  const round1 = (v) => Math.round(v * 10) / 10;

  /**
   * Dark twins of a custom property, e.g. `--bg: #fff` -> `--nw-bg-bg: #1a1a1a` and
   * `--nw-fg-bg: #fff`. Handles plain colours, colour channel lists used as
   * `rgb(var(--x))` / `hsl(var(--x))`, var() chains and values containing colours.
   */
  function convertCustomProperty(value) {
    const v = value.trim();
    if (!v) return null;
    const rgb = RGB_CHANNELS.exec(v);
    if (rgb && [rgb[1], rgb[3], rgb[4]].every((x) => +x <= 255)) {
      const c = new Color(+rgb[1] / 255, +rgb[3] / 255, +rgb[4] / 255);
      const fmt = (d) => d.bytes.join(rgb[2]);
      return { bg: fmt(c.adjusted("bg")), text: fmt(c.adjusted("text")) };
    }
    const hsl = HSL_CHANNELS.exec(v);
    if (hsl) {
      const c = Color.fromHSL(((+hsl[1] % 360) + 360) % 360 / 360, +hsl[4] / 100, +hsl[5] / 100);
      const fmt = (d) => { const x = d.hsl; return `${round1(x.h * 360)}${hsl[2] || ""}${hsl[3]}${round1(x.s * 100)}%${hsl[3]}${round1(x.l * 100)}%`; };
      return { bg: fmt(c.adjusted("bg")), text: fmt(c.adjusted("text")) };
    }
    const words = v.toLowerCase().match(/[a-z]+/g) || [];
    if (!COLORISH.test(v) && !words.some((w) => Object.prototype.hasOwnProperty.call(NAMED, w))) return null;
    const bg = convertValue(v, "bg"), text = convertValue(v, "text");
    return bg === null || text === null ? null : { bg, text };
  }

  // ---------------------------------------------------------------------------------------
  // Rules

  const ROOT_SELECTOR = /^(html|:root)(?![\w-])/i;

  /**
   * `.a, body .b, html.x` -> `html[gate] .a, html[gate].a, html[gate] body .b, html[gate].x`.
   * A selector that starts with a class, attribute, id or pseudo-class may also match <html>
   * itself (GitHub defines its colour variables on `[data-color-mode="light"]`), so it gets a
   * second form that applies to the root. Both forms add the same specificity.
   */
  function scoped(selectorText) {
    const out = [];
    for (const raw of splitTopLevel(selectorText, ",")) {
      const s = raw.trim();
      if (!s) continue;
      const m = ROOT_SELECTOR.exec(s);
      if (m) { out.push(GATE + s.slice(m[0].length)); continue; }
      out.push(`${GATE} ${s}`);
      if (/^[.#[:*]/.test(s) && !s.startsWith("::")) out.push(GATE + (s[0] === "*" ? s.slice(1) : s));
    }
    return out.join(",");
  }

  /** The dark declarations for one CSSStyleDeclaration (a rule's or an element's). */
  function darkDeclarations(style, stats, forceImportant) {
    const decls = [];
    const imp = (p) => (forceImportant || style.getPropertyPriority(p) ? " !important" : "");
    const image = style.getPropertyValue("background-image");
    // Where a background image is involved we can't know how light it is: keep the colours
    // (but still copy them, so the copy relates to other copies exactly as before).
    const keep = /url\(/i.test(image);
    let pending = false;
    for (let i = 0; i < style.length; i++) {
      const prop = style[i];
      if (prop.startsWith("--")) {
        const twins = convertCustomProperty(style.getPropertyValue(prop));
        if (twins) {
          decls.push(`${PREFIX.bg}${prop.slice(2)}:${twins.bg}${imp(prop)}`, `${PREFIX.text}${prop.slice(2)}:${twins.text}${imp(prop)}`);
          stats.variables++;
        }
        continue;
      }
      const role = ROLE[prop];
      if (!role) continue;
      const value = style.getPropertyValue(prop);
      if (value === "") { pending = true; continue; }  // part of a shorthand with var()
      if (prop === "background-image" && !/gradient\(/i.test(value)) continue;
      const dark = keep ? value : convertValue(value, role);
      if (dark === null) { stats.dropped++; continue; }
      decls.push(`${prop}:${dark}${imp(prop)}`);
    }
    if (pending) {
      for (const [shorthand, role] of SHORTHANDS) {
        const value = style.getPropertyValue(shorthand);
        if (!value || !/var\(/i.test(value)) continue;
        const dark = keep ? value : rewriteTokens(value, role);
        if (dark === null) { stats.dropped++; continue; }
        decls.push(`${shorthand}:${dark}${imp(shorthand)}`);
      }
    }
    return decls;
  }

  function copyRules(rules, nested, out) {
    let css = "";
    for (const rule of rules) {
      if (nested && !("selectorText" in rule) && rule.style && !("cssRules" in rule)) {
        // Declarations directly inside a nested @media (CSSNestedDeclarations).
        const decls = darkDeclarations(rule.style, out.stats, false);
        if (decls.length) css += decls.join(";") + ";";
      } else if ("selectorText" in rule && rule.style) {
        const decls = darkDeclarations(rule.style, out.stats, false);
        const inner = rule.cssRules && rule.cssRules.length ? copyRules(rule.cssRules, true, out) : "";
        if (!decls.length && !inner) continue;
        out.stats.rules++;
        css += `${nested ? rule.selectorText : scoped(rule.selectorText)}{${decls.join(";")}${decls.length ? ";" : ""}${inner}}`;
        // A body background normally fills the window; our root default would stop that.
        if (!nested && rule.selectorText.trim().toLowerCase() === "body") {
          const bg = decls.find((d) => d.startsWith("background-color:"));
          if (bg) out.root += `${GATE}{${bg.replace(" !important", "")}}`;
        }
      } else if ("styleSheet" in rule && "href" in rule) {
        out.imports.push(rule);
      } else if ("cssRules" in rule && !("appendRule" in rule)) {  // grouping rules, not @keyframes
        const inner = copyRules(rule.cssRules, nested, out);
        if (!inner) continue;
        let prelude;
        if ("media" in rule && rule.media) prelude = `@media ${rule.media.mediaText}`;
        else if ("containerQuery" in rule) prelude = `@container ${rule.containerName || ""} ${rule.containerQuery}`;
        else if ("conditionText" in rule) prelude = `@supports ${rule.conditionText}`;
        else if ("name" in rule && typeof rule.name === "string") prelude = `@layer ${rule.name}`;
        else prelude = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
        css += `${prelude}{${inner}}`;
      }
    }
    return css;
  }

  // ---------------------------------------------------------------------------------------
  // Contrast helpers

  function contrast(a, b) {
    const x = a.luminance, y = b.luminance;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function blend(fg, bg) {
    if (fg.a >= 1) return fg;
    return new Color(fg.r * fg.a + bg.r * (1 - fg.a), fg.g * fg.a + bg.g * (1 - fg.a), fg.b * fg.a + bg.b * (1 - fg.a));
  }

  /** The colour behind an element, or null if a background image is in the way. */
  function backgroundBehind(el, win) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = win.getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        if (!/gradient\(/i.test(cs.backgroundImage)) return null;
        const m = /rgba?\([^)]*\)/i.exec(cs.backgroundImage);
        if (m) return parseColor(m[0]);
      }
      const c = parseColor(cs.backgroundColor);
      if (c && c.a > 0.5) return c;
    }
    const scheme = win.getComputedStyle(el.ownerDocument.documentElement).colorScheme || "";
    return scheme.includes("dark") ? new Color(0.11, 0.11, 0.11) : new Color(1, 1, 1);
  }

  // ---------------------------------------------------------------------------------------
  // Engine

  class Engine {
    constructor(doc, fetchCSS) {
      this.doc = doc;
      this.win = doc.defaultView;
      this.fetchCSS = fetchCSS;
      this.sheetCache = new WeakMap();   // sheet -> { count, out }
      this.fetchedCache = new Map();     // href -> out
      this.elements = new Map();         // id -> { ref, css }
      this.elementIds = new WeakMap();
      this.nextId = 1;
      this.fixes = new Map();
      this.svgColours = new WeakMap();
      this.stats = { rules: 0, variables: 0, dropped: 0 };
      this.active = false;
      this.status = { state: "idle" };
    }

    newOut() { return { root: "", imports: [], stats: { rules: 0, variables: 0, dropped: 0 } }; }

    /** True if the page already has a dark background where people look. */
    looksDark() {
      const { win, doc } = this;
      const w = win.innerWidth, h = win.innerHeight;
      let dark = 0, total = 0;
      for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const fy of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          const el = doc.elementFromPoint(w * fx, h * fy);
          if (!el) continue;
          const bg = backgroundBehind(el, win);
          if (!bg) continue;
          total++;
          if (bg.luminance < 0.2) dark++;
        }
      }
      return total > 0 && dark / total >= 0.6;
    }

    async copySheet(sheet) {
      let rules = null;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        if (e.name !== "SecurityError" || !sheet.href) return null;  // not loaded yet
        return this.copyFetched(sheet.href);
      }
      const cached = this.sheetCache.get(sheet);
      if (cached && cached.count === rules.length) return cached.out;
      const out = this.newOut();
      out.css = copyRules(rules, false, out);
      for (const imp of out.imports) {
        const inner = imp.styleSheet ? await this.copySheet(imp.styleSheet) : null;
        if (inner) {
          out.root += inner.root;
          const media = imp.media && imp.media.mediaText;
          out.css = (media ? `@media ${media}{${inner.css}}` : inner.css) + out.css;
          for (const k in out.stats) out.stats[k] += inner.stats[k];
        }
      }
      out.imports = [];
      this.sheetCache.set(sheet, { count: rules.length, out });
      return out;
    }

    /** A stylesheet from another site: fetched by the background script and parsed here. */
    async copyFetched(href, depth = 0) {
      if (this.fetchedCache.has(href)) return this.fetchedCache.get(href);
      this.status.fetched = (this.status.fetched || 0) + 1;
      const text = await this.fetchCSS(href);
      if (text == null) { this.status.unreadable = (this.status.unreadable || 0) + 1; this.fetchedCache.set(href, null); return null; }
      const out = this.newOut();
      out.css = "";
      if (depth < 4) {
        for (const m of text.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?([^;]*);/gi)) {
          let url;
          try { url = new URL(m[1], href).href; } catch (e) { continue; }
          const inner = await this.copyFetched(url, depth + 1);
          if (!inner) continue;
          const media = m[2].trim();
          out.css += media ? `@media ${media}{${inner.css}}` : inner.css;
          out.root += inner.root;
        }
      }
      const parser = this.doc.implementation.createHTMLDocument("");
      const style = parser.createElement("style");
      style.textContent = text.replace(/@import[^;]*;/gi, "");
      parser.head.appendChild(style);
      if (style.sheet) out.css += copyRules(style.sheet.cssRules, false, out);
      out.imports = [];
      this.fetchedCache.set(href, out);
      return out;
    }

    sheets() {
      const list = [];
      for (const s of this.doc.styleSheets) {
        if (s.ownerNode && (s.ownerNode.id === STYLE_ID || s.ownerNode.id === DYNAMIC_ID)) continue;
        list.push(s);
      }
      try { for (const s of this.doc.adoptedStyleSheets || []) list.push(s); } catch (e) { /* not supported */ }
      return list;
    }

    // Inline styles and colour attributes ------------------------------------------------

    /** True for SVG elements inside a multi-colour graphic (logo, illustration): leave those. */
    inIllustration(el) {
      const svg = el.closest("svg");
      if (!svg) return false;
      if (this.svgColours.has(svg)) return this.svgColours.get(svg);
      const colours = new Set();
      for (const e of svg.querySelectorAll("[fill],[stroke]")) {
        for (const name of ["fill", "stroke"]) {
          const c = e.getAttribute(name) && parseColor(e.getAttribute(name));
          if (c) colours.add(c.css());
        }
      }
      const result = colours.size > 2;
      this.svgColours.set(svg, result);
      return result;
    }

    elementRule(el) {
      const decls = [];
      if (el.hasAttribute("style") && el.style && el.style.length) {
        decls.push(...darkDeclarations(el.style, this.stats, true));
      }
      const tag = el.localName;
      const attr = (name, prop, role) => {
        const v = el.getAttribute(name);
        if (!v) return;
        const c = parseColor(v) || (/^[0-9a-f]{6}$/i.test(v) ? parseColor("#" + v) : null);
        if (c) decls.push(`${prop}:${c.adjusted(role).css()}`);
      };
      if (el.hasAttribute("bgcolor")) attr("bgcolor", "background-color", "bg");
      if (tag === "font") attr("color", "color", "text");
      if (tag === "body") attr("text", "color", "text");
      if (el.namespaceURI === "http://www.w3.org/2000/svg" && !this.inIllustration(el)) {
        attr("fill", "fill", "text");
        attr("stroke", "stroke", "text");
      }
      return decls;
    }

    /** Updates one element's override. Returns true if the dark styles changed. */
    updateElement(el) {
      const decls = this.elementRule(el);
      let id = this.elementIds.get(el);
      if (!decls.length) {
        if (!id) return false;
        this.elements.delete(id);
        el.removeAttribute(ID_ATTR);
        this.elementIds.delete(el);
        return true;
      }
      if (!id) {
        id = this.nextId++;
        this.elementIds.set(el, id);
        el.setAttribute(ID_ATTR, String(id));
      }
      const css = `:where(${GATE} [${ID_ATTR}="${id}"]){${decls.join(";")}}`;
      const old = this.elements.get(id);
      if (old && old.css === css) return false;
      this.elements.set(id, { ref: new WeakRef(el), css });
      return true;
    }

    scanElements(rootNode) {
      const sel = "[style],[bgcolor],font[color],body[text],svg [fill],svg [stroke]";
      let changed = false;
      if (rootNode.nodeType === 1 && rootNode.matches(sel)) changed = this.updateElement(rootNode) || changed;
      if (rootNode.querySelectorAll) for (const el of rootNode.querySelectorAll(sel)) changed = this.updateElement(el) || changed;
      return changed;
    }

    // Building and applying --------------------------------------------------------------

    /** The dark copies of all stylesheets (changes rarely). */
    async buildSheets() {
      const started = performance.now();
      this.stats = { rules: 0, variables: 0, dropped: 0 };
      let root = "", css = "", sheets = 0;
      for (const sheet of this.sheets()) {
        if (sheet.disabled) continue;
        const out = await this.copySheet(sheet);
        if (!out) continue;
        sheets++;
        root += out.root;
        const media = sheet.media && sheet.media.mediaText;
        css += media && media !== "all" ? `@media ${media}{${out.css}}` : out.css;
        for (const k in out.stats) this.stats[k] += out.stats[k];
      }
      this.status.sheets = sheets;
      Object.assign(this.status, this.stats);
      this.status.buildMs = Math.round(performance.now() - started);
      return `@media screen{${BASE}${root}${css}}`;
    }

    /** Overrides for inline styles and colour attributes, and readability fixes (changes often). */
    buildDynamic() {
      const parts = [];
      for (const [id, entry] of this.elements) {
        const el = entry.ref.deref();
        if (!el || !el.isConnected) { this.elements.delete(id); continue; }
        parts.push(entry.css);
      }
      this.status.inline = parts.length;
      return `@media screen{${parts.join("")}${[...this.fixes.values()].join("")}}`;
    }

    setStyle(id, css) {
      let el = this.doc.getElementById(id);
      if (!el) {
        el = this.doc.createElement("style");
        el.id = id;
      }
      if (!el.isConnected) this.doc.documentElement.appendChild(el);
      if (el.textContent !== css) el.textContent = css;
    }

    async apply() {
      if (this.sheetsDirty) {
        this.sheetsDirty = false;
        const css = await this.buildSheets();
        if (!this.active) return;
        this.setStyle(STYLE_ID, css);
      }
      if (this.dynamicDirty) {
        this.dynamicDirty = false;
        this.setStyle(DYNAMIC_ID, this.buildDynamic());
      }
      if (this.active && !this.doc.documentElement.hasAttribute(GATE_ATTR)) this.doc.documentElement.setAttribute(GATE_ATTR, "");
    }

    schedule({ sheets = false, dynamic = false } = {}, delay = 80) {
      if (sheets) this.sheetsDirty = true;
      if (dynamic) this.dynamicDirty = true;
      if (this.timer) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.apply().then(() => { if (sheets) this.scheduleSafetyNet(); });
      }, delay);
    }

    async start({ force = false } = {}) {
      if (this.active) return;
      if (!force && this.looksDark()) {
        this.status = { state: "already-dark" };
        return;
      }
      this.active = true;
      this.status = { state: "active" };
      this.svgColours = new WeakMap();
      this.stats = { rules: 0, variables: 0, dropped: 0 };
      this.scanElements(this.doc.documentElement);
      this.sheetsDirty = this.dynamicDirty = true;
      await this.apply();
      this.observe();
      this.scheduleSafetyNet(250);
    }

    stop(state = "off") {
      this.active = false;
      clearTimeout(this.timer); this.timer = null;
      clearTimeout(this.netTimer);
      clearInterval(this.poll);
      if (this.observer) this.observer.disconnect();
      this.doc.documentElement.removeAttribute(GATE_ATTR);
      for (const id of [STYLE_ID, DYNAMIC_ID]) { const el = this.doc.getElementById(id); if (el) el.remove(); }
      for (const el of this.doc.querySelectorAll(`[${ID_ATTR}],[${FIX_ATTR}]`)) { el.removeAttribute(ID_ATTR); el.removeAttribute(FIX_ATTR); }
      this.elements.clear();
      this.elementIds = new WeakMap();
      this.fixes.clear();
      this.status = { state };
    }

    observe() {
      const isSheetNode = (n) => n.nodeType === 1 && (n.localName === "style" || (n.localName === "link" && /stylesheet/i.test(n.rel || "")));
      const ours = (n) => n.nodeType === 1 && (n.id === STYLE_ID || n.id === DYNAMIC_ID);
      this.observer = new this.win.MutationObserver((records) => {
        let sheets = false, dynamic = false;
        for (const r of records) {
          if (r.type === "attributes") {
            if (r.target === this.doc.documentElement && r.attributeName === GATE_ATTR) {
              if (!r.target.hasAttribute(GATE_ATTR)) dynamic = true;  // someone removed it: re-add
              continue;
            }
            if (this.updateElement(r.target)) dynamic = true;
          } else if (r.type === "characterData") {
            const p = r.target.parentNode;
            if (p && p.localName === "style" && !ours(p)) sheets = true;
          } else {
            if (ours(r.target)) continue;
            if (r.target.localName === "style") sheets = true;
            for (const n of r.addedNodes) {
              if (n.nodeType !== 1 || ours(n)) continue;
              if (isSheetNode(n) || n.querySelector("style,link[rel~=stylesheet]")) sheets = true;
              if (this.scanElements(n)) dynamic = true;
            }
            for (const n of r.removedNodes) {
              if (ours(n)) { sheets = dynamic = true; continue; }
              if (isSheetNode(n)) sheets = true;
            }
          }
        }
        if (sheets || dynamic) this.schedule({ sheets, dynamic });
      });
      this.observer.observe(this.doc, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ["style", "bgcolor", "color", "text", "fill", "stroke", GATE_ATTR],
      });
      if (!this.listening) {
        this.listening = true;
        // Stylesheets that finish loading after we started.
        this.doc.addEventListener("load", (e) => { if (this.active && e.target.localName === "link") this.schedule({ sheets: true }); }, true);
      }
      // Rules added with insertRule() (CSS-in-JS) don't show up as DOM mutations.
      this.poll = setInterval(() => {
        if (!this.active) return;
        for (const sheet of this.sheets()) {
          let count;
          try { count = sheet.cssRules.length; } catch (e) { continue; }
          const cached = this.sheetCache.get(sheet);
          if (!cached || cached.count !== count) { this.schedule({ sheets: true }, 0); return; }
        }
      }, 1500);
    }

    // Readability safety net --------------------------------------------------------------

    scheduleSafetyNet(delay = 1200) {
      clearTimeout(this.netTimer);
      this.netTimer = setTimeout(() => this.safetyNet(), delay);
    }

    /**
     * Finds text the dark copy made hard to read (for example dark text on a background we
     * couldn't convert) and gives it a readable colour.
     */
    safetyNet() {
      if (!this.active || !this.doc.body) return;
      const { doc, win } = this;
      const walker = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_TEXT);
      const seen = new Set();
      let checked = 0, added = 0, node;
      while ((node = walker.nextNode()) && checked < 2000) {
        if (!node.data.trim()) continue;
        const el = node.parentElement;
        if (!el || seen.has(el) || el.hasAttribute(FIX_ATTR) || el.closest("style,script,noscript,svg")) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (!rect.width || rect.bottom < -400 || rect.top > win.innerHeight * 3) continue;
        checked++;
        const cs = win.getComputedStyle(el);
        if (cs.visibility === "hidden" || parseFloat(cs.fontSize) < 6) continue;
        const fg = parseColor(cs.color);
        if (!fg || fg.a < 0.25) continue;
        const bg = backgroundBehind(el, win);
        if (!bg) continue;
        if (contrast(blend(fg, bg), bg) >= 2) continue;
        const id = this.nextId++;
        el.setAttribute(FIX_ATTR, String(id));
        const target = bg.luminance < 0.2 ? fg.adjusted("text").css() : "#1a1a1a";
        this.fixes.set(id, `${GATE} [${FIX_ATTR}="${id}"]{color:${target} !important;-webkit-text-fill-color:${target} !important}`);
        added++;
      }
      if (added) {
        this.status.fixes = (this.status.fixes || 0) + added;
        this.schedule({ dynamic: true }, 0);
      }
    }
  }

  root.NocturneEngine = { Engine, convertValue, convertCustomProperty, rewriteTokens, scoped, GATE_ATTR, STYLE_ID, DYNAMIC_ID };
})(typeof globalThis !== "undefined" ? globalThis : this);
