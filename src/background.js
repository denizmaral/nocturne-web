// Fetches stylesheets from other sites (a content script isn't allowed to read them) and
// handles the keyboard shortcut.
"use strict";

const MAX_CSS_BYTES = 5 * 1024 * 1024;
const cache = new Map();

async function fetchCSS(url) {
  if (!/^https?:\/\//i.test(url)) return null;
  if (cache.has(url)) return cache.get(url);
  let text = null;
  try {
    // No cookies, and only real stylesheets: a page must not be able to use us to read
    // other sites' private data.
    const res = await fetch(url, { credentials: "omit", cache: "force-cache" });
    const type = res.headers.get("content-type") || "";
    if (res.ok && /\bcss\b/i.test(type)) {
      const body = await res.text();
      if (body.length <= MAX_CSS_BYTES) text = body;
    }
  } catch (e) {
    text = null;
  }
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(url, text);
  return text;
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "fetch-css") return fetchCSS(msg.url);
  return undefined;
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-site") return;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return;
  let host;
  try { host = new URL(tab.url).hostname; } catch (e) { return; }
  const { sites = {} } = await browser.storage.local.get("sites");
  sites[host] = sites[host] === "off" ? "auto" : "off";
  await browser.storage.local.set({ sites });
});
