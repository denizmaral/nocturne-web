// Starts the engine on each page and follows the user's settings.
"use strict";

(() => {
  if (window.__nocturneWeb) return;
  window.__nocturneWeb = true;

  const host = location.hostname || location.protocol;
  const fetchCSS = (url) => browser.runtime.sendMessage({ type: "fetch-css", url }).catch(() => null);
  const engine = new NocturneEngine.Engine(document, fetchCSS);
  let settings = { enabled: true, sites: {} };

  /** "on" (forced), "off", or "auto" (on unless the page is already dark). */
  const siteMode = () => settings.sites[host] || "auto";

  async function update() {
    const mode = siteMode();
    const want = settings.enabled && mode !== "off";
    if (!want) {
      if (engine.active || engine.status.state !== "off") engine.stop(settings.enabled ? "site-off" : "disabled");
      return;
    }
    if (engine.active && mode === "auto") return;
    if (engine.active) return;
    await engine.start({ force: mode === "on" });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
    if (changes.sites) settings.sites = changes.sites.newValue || {};
    update();
  });

  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "status" && window === window.top) {
      return Promise.resolve({ host, mode: siteMode(), enabled: settings.enabled, ...engine.status });
    }
    return undefined;
  });

  browser.storage.local.get({ enabled: true, sites: {} }).then((s) => {
    settings = { enabled: s.enabled !== false, sites: s.sites || {} };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update, { once: true });
    else update();
  });
})();
