// Starts the engine on each page and follows the user's settings.
"use strict";

(() => {
  if (window.__nocturneWeb) return;
  window.__nocturneWeb = true;

  const isTop = window === window.top;

  // 1. A dark placeholder from the very first paint, so pages don't flash white while the
  //    real dark styles are built. It is coarse on purpose and removed as soon as they apply.
  let placeholder = null;
  if (isTop && document.documentElement instanceof HTMLHtmlElement) {
    placeholder = document.createElement("style");
    placeholder.id = "nocturne-web-placeholder";
    placeholder.media = "screen";
    placeholder.textContent =
      "html{background-color:#1a1a1a!important;color-scheme:dark!important}" +
      "html,body,body :not(img,video,canvas,picture,svg,svg *,iframe,embed,object)" +
      "{background-color:#1a1a1a!important;color:#ebebeb!important;border-color:#3a3a3a!important;transition:none!important}";
    document.documentElement.appendChild(placeholder);
  }
  const dropPlaceholder = () => { if (placeholder) { placeholder.remove(); placeholder = null; } };

  const host = location.hostname || location.protocol;
  const fetchCSS = (url) => browser.runtime.sendMessage({ type: "fetch-css", url }).catch(() => null);
  const engine = new NocturneEngine.Engine(document, fetchCSS);
  let settings = { enabled: true, sites: {} };

  // 2. Hear about styles added from JavaScript (CSS-in-JS libraries such as styled-components
  //    call insertRule(), which no DOM mutation reports) the moment they happen. Our own calls
  //    go through Xray wrappers and don't reach these page-level hooks.
  (function hookStyleAPIs() {
    const page = window.wrappedJSObject;
    if (!page || typeof exportFunction !== "function") return;
    const notify = () => { try { engine.notifyStylesChanged(); } catch (e) { /* never break the page */ } };
    const wrap = (proto, name, async) => {
      try {
        const original = proto && proto[name];
        if (typeof original !== "function") return;
        // Rest parameters keep the arguments on our side of the security boundary;
        // passing `arguments` itself to page code fails with "Permission denied".
        exportFunction(function (...args) {
          const result = original.call(this, ...args);
          notify();
          if (async) setTimeout(notify, 0);
          return result;
        }, proto, { defineAs: name });
      } catch (e) { /* leave this API alone */ }
    };
    const sheet = page.CSSStyleSheet && page.CSSStyleSheet.prototype;
    for (const name of ["insertRule", "deleteRule", "addRule", "removeRule", "replaceSync"]) wrap(sheet, name, false);
    wrap(sheet, "replace", true);
    const grouping = page.CSSGroupingRule && page.CSSGroupingRule.prototype;
    for (const name of ["insertRule", "deleteRule"]) wrap(grouping, name, false);
    for (const proto of [page.Document && page.Document.prototype, page.ShadowRoot && page.ShadowRoot.prototype]) {
      try {
        const desc = proto && Object.getOwnPropertyDescriptor(proto, "adoptedStyleSheets");
        if (!desc || !desc.set) continue;
        const { get, set } = desc;
        Object.defineProperty(proto, "adoptedStyleSheets", {
          configurable: true,
          enumerable: desc.enumerable,
          get: exportFunction(function () { return get.call(this); }, page),
          set: exportFunction(function (value) { set.call(this, value); notify(); }, page),
        });
      } catch (e) { /* leave it alone */ }
    }
  })();

  /** "on" (forced), "off", or "auto" (on unless the page is already dark). */
  const siteMode = () => settings.sites[host] || "auto";

  async function update() {
    const mode = siteMode();
    const want = settings.enabled && mode !== "off";
    if (!want) {
      dropPlaceholder();
      if (engine.active || engine.status.state !== "off") engine.stop(settings.enabled ? "site-off" : "disabled");
      return;
    }
    if (engine.active) return;
    await engine.start({ force: mode === "on", placeholder });
    placeholder = null;  // the engine has removed it
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue !== false;
    if (changes.sites) settings.sites = changes.sites.newValue || {};
    update();
  });

  browser.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "status" && isTop) {
      return Promise.resolve({ host, mode: siteMode(), enabled: settings.enabled, ...engine.status });
    }
    return undefined;
  });

  browser.storage.local.get({ enabled: true, sites: {} }).then((s) => {
    settings = { enabled: s.enabled !== false, sites: s.sites || {} };
    const mode = siteMode();
    if (!settings.enabled || mode === "off") { update(); return; }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", update, { once: true });
    else update();
  });
})();
