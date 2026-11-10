// Colour maths shared with Nocturne for Mail (Extension/DarkStyler.swift, struct Color).
// Keep the two in step: tests/color-parity.json is generated from the Swift code.
"use strict";

(function (root) {
  const NAMED = {aliceblue:'f0f8ff',antiquewhite:'faebd7',aqua:'00ffff',aquamarine:'7fffd4',azure:'f0ffff',beige:'f5f5dc',bisque:'ffe4c4',black:'000000',blanchedalmond:'ffebcd',blue:'0000ff',blueviolet:'8a2be2',brown:'a52a2a',burlywood:'deb887',cadetblue:'5f9ea0',chartreuse:'7fff00',chocolate:'d2691e',coral:'ff7f50',cornflowerblue:'6495ed',cornsilk:'fff8dc',crimson:'dc143c',cyan:'00ffff',darkblue:'00008b',darkcyan:'008b8b',darkgoldenrod:'b8860b',darkgray:'a9a9a9',darkgreen:'006400',darkgrey:'a9a9a9',darkkhaki:'bdb76b',darkmagenta:'8b008b',darkolivegreen:'556b2f',darkorange:'ff8c00',darkorchid:'9932cc',darkred:'8b0000',darksalmon:'e9967a',darkseagreen:'8fbc8f',darkslateblue:'483d8b',darkslategray:'2f4f4f',darkslategrey:'2f4f4f',darkturquoise:'00ced1',darkviolet:'9400d3',deeppink:'ff1493',deepskyblue:'00bfff',dimgray:'696969',dimgrey:'696969',dodgerblue:'1e90ff',firebrick:'b22222',floralwhite:'fffaf0',forestgreen:'228b22',fuchsia:'ff00ff',gainsboro:'dcdcdc',ghostwhite:'f8f8ff',gold:'ffd700',goldenrod:'daa520',gray:'808080',grey:'808080',green:'008000',greenyellow:'adff2f',honeydew:'f0fff0',hotpink:'ff69b4',indianred:'cd5c5c',indigo:'4b0082',ivory:'fffff0',khaki:'f0e68c',lavender:'e6e6fa',lavenderblush:'fff0f5',lawngreen:'7cfc00',lemonchiffon:'fffacd',lightblue:'add8e6',lightcoral:'f08080',lightcyan:'e0ffff',lightgoldenrodyellow:'fafad2',lightgray:'d3d3d3',lightgreen:'90ee90',lightgrey:'d3d3d3',lightpink:'ffb6c1',lightsalmon:'ffa07a',lightseagreen:'20b2aa',lightskyblue:'87cefa',lightslategray:'778899',lightslategrey:'778899',lightsteelblue:'b0c4de',lightyellow:'ffffe0',lime:'00ff00',limegreen:'32cd32',linen:'faf0e6',magenta:'ff00ff',maroon:'800000',mediumaquamarine:'66cdaa',mediumblue:'0000cd',mediumorchid:'ba55d3',mediumpurple:'9370db',mediumseagreen:'3cb371',mediumslateblue:'7b68ee',mediumspringgreen:'00fa9a',mediumturquoise:'48d1cc',mediumvioletred:'c71585',midnightblue:'191970',mintcream:'f5fffa',mistyrose:'ffe4e1',moccasin:'ffe4b5',navajowhite:'ffdead',navy:'000080',oldlace:'fdf5e6',olive:'808000',olivedrab:'6b8e23',orange:'ffa500',orangered:'ff4500',orchid:'da70d6',palegoldenrod:'eee8aa',palegreen:'98fb98',paleturquoise:'afeeee',palevioletred:'db7093',papayawhip:'ffefd5',peachpuff:'ffdab9',peru:'cd853f',pink:'ffc0cb',plum:'dda0dd',powderblue:'b0e0e6',purple:'800080',rebeccapurple:'663399',red:'ff0000',rosybrown:'bc8f8f',royalblue:'4169e1',saddlebrown:'8b4513',salmon:'fa8072',sandybrown:'f4a460',seagreen:'2e8b57',seashell:'fff5ee',sienna:'a0522d',silver:'c0c0c0',skyblue:'87ceeb',slateblue:'6a5acd',slategray:'708090',slategrey:'708090',snow:'fffafa',springgreen:'00ff7f',steelblue:'4682b4',tan:'d2b48c',teal:'008080',thistle:'d8bfd8',tomato:'ff6347',turquoise:'40e0d0',violet:'ee82ee',wheat:'f5deb3',white:'ffffff',whitesmoke:'f5f5f5',yellow:'ffff00',yellowgreen:'9acd32'};

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

  class Color {
    constructor(r, g, b, a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; }

    /** WCAG relative luminance. */
    get luminance() { return 0.2126 * lin(this.r) + 0.7152 * lin(this.g) + 0.0722 * lin(this.b); }

    get hsl() {
      const { r, g, b } = this;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2, d = mx - mn;
      if (!(d > 0)) return { h: 0, s: 0, l };
      const s = d / (1 - Math.abs(2 * l - 1));
      let h;
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return { h: h / 6, s, l };
    }

    static fromHSL(h, s, l, a = 1) {
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = (h - Math.floor(h)) * 6;
      const x = c * (1 - Math.abs((hp % 2) - 1));
      let r1, g1, b1;
      if (hp < 1) [r1, g1, b1] = [c, x, 0];
      else if (hp < 2) [r1, g1, b1] = [x, c, 0];
      else if (hp < 3) [r1, g1, b1] = [0, c, x];
      else if (hp < 4) [r1, g1, b1] = [0, x, c];
      else if (hp < 5) [r1, g1, b1] = [x, 0, c];
      else [r1, g1, b1] = [c, 0, x];
      const m = l - c / 2;
      return new Color(r1 + m, g1 + m, b1 + m, a);
    }

    /** Same hue and chroma ("amount of colour"), new lightness. */
    withLightness(newL) {
      const { h } = this.hsl;
      const chroma = Math.max(this.r, this.g, this.b) - Math.min(this.r, this.g, this.b);
      const maxChroma = 1 - Math.abs(2 * newL - 1);
      const s = maxChroma > 0 ? Math.min(chroma / maxChroma, 1) : 0;
      return Color.fromHSL(h, s, newL, this.a);
    }

    /** Light backgrounds -> dark, dark text -> light; everything else unchanged. */
    adjusted(role) {
      const y = this.luminance;
      if (role === "bg") {
        if (!(y > 0.25)) return this;
        let l = 0.1 + (1 - y) * 0.4;
        let c = this.withLightness(l);
        while (c.luminance > 0.06 && l > 0.02) { l -= 0.01; c = this.withLightness(l); }
        return c;
      }
      if (!(y < 0.3)) return this;
      let l = Math.min(Math.max(1 - this.hsl.l, 0.6), 0.92);
      let c = this.withLightness(l);
      while (c.luminance < 0.35 && l < 0.97) { l += 0.01; c = this.withLightness(l); }
      return c;
    }

    get bytes() { return [this.r, this.g, this.b].map((v) => Math.round(clamp01(v) * 255)); }

    css() {
      const [r, g, b] = this.bytes;
      if (this.a < 1) return `rgba(${r},${g},${b},${Math.round(this.a * 1000) / 1000})`;
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }
  }

  function fromHex(hex) {
    let h = hex;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if ((h.length !== 6 && h.length !== 8) || !/^[0-9a-f]+$/i.test(h)) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return new Color(n(0), n(2), n(4), h.length === 8 ? n(6) : 1);
  }

  const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(%|deg|turn|rad|grad)?/gi;

  function fromFunction(t) {
    if (!t.endsWith(")") || t.includes("var(") || t.includes("calc(") || t.includes("from ")) return null;
    const parts = [...t.slice(t.indexOf("(") + 1, -1).matchAll(NUMBER)].map((m) => ({ v: parseFloat(m[0]), u: (m[1] || "").toLowerCase() }));
    if (parts.length !== 3 && parts.length !== 4) return null;
    const alpha = parts.length === 4 ? (parts[3].u === "%" ? parts[3].v / 100 : parts[3].v) : 1;
    let c;
    if (t.startsWith("rgb")) {
      const ch = parts.slice(0, 3).map((p) => (p.u === "%" ? p.v / 100 : p.v / 255));
      c = new Color(ch[0], ch[1], ch[2], alpha);
    } else {
      let h = parts[0].v;
      if (parts[0].u === "turn") h *= 360;
      else if (parts[0].u === "rad") h = (h * 180) / Math.PI;
      else if (parts[0].u === "grad") h *= 0.9;
      c = Color.fromHSL(h / 360, parts[1].v / 100, parts[2].v / 100, alpha);
    }
    c.r = clamp01(c.r); c.g = clamp01(c.g); c.b = clamp01(c.b); c.a = clamp01(c.a);
    return c;
  }

  /** Fast parser for hex, rgb(), hsl() and named colours. Returns null for anything else. */
  function parseFast(raw) {
    const t = raw.trim().toLowerCase();
    if (t.startsWith("#")) return fromHex(t.slice(1));
    if (t.startsWith("rgb(") || t.startsWith("rgba(") || t.startsWith("hsl(") || t.startsWith("hsla(")) return fromFunction(t);
    if (Object.prototype.hasOwnProperty.call(NAMED, t)) return fromHex(NAMED[t]);
    return null;
  }

  // Any other CSS colour (oklch(), lab(), color-mix() of known colours...) is resolved by
  // letting the browser paint it into a 1x1 canvas and reading the pixel back.
  let ctx = null;
  const cache = new Map();
  function parseWithCanvas(raw) {
    if (cache.has(raw)) return cache.get(raw);
    let result = null;
    try {
      if (!ctx) {
        const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }
      for (const sentinel of ["#010203", "#040506"]) {
        ctx.fillStyle = sentinel;
        ctx.fillStyle = raw;
        if (ctx.fillStyle === sentinel) { result = null; break; }  // not a colour the canvas understands
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        result = new Color(r / 255, g / 255, b / 255, a / 255);
        break;
      }
    } catch (e) { result = null; }
    if (cache.size > 2000) cache.clear();
    cache.set(raw, result);
    return result;
  }

  const KEYWORDS = new Set(["", "transparent", "inherit", "initial", "unset", "revert", "revert-layer", "currentcolor", "none", "auto"]);

  /** Parses one colour. Keywords, system colours and anything with var() return null. */
  function parseColor(raw) {
    const t = raw.trim();
    const lower = t.toLowerCase();
    if (KEYWORDS.has(lower) || lower.includes("var(")) return null;
    const fast = parseFast(t);
    if (fast) return fast;
    if (/^[a-z-]+$/i.test(t)) return null;  // unknown word: invalid, or a system colour like CanvasText
    if (/^(?:oklch|oklab|lab|lch|hwb|color|color-mix)\(/i.test(t)) return parseWithCanvas(t);
    return null;
  }

  root.NocturneColor = { Color, parseFast, parseColor, NAMED, KEYWORDS };
})(typeof globalThis !== "undefined" ? globalThis : this);
