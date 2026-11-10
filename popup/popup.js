"use strict";

const $ = (id) => document.getElementById(id);

const STATUS_TEXT = {
  "active": "Dark mode is on for this page.",
  "already-dark": "This page already looks dark, so Nocturne leaves it as it is.",
  "site-off": "Dark mode is off for this site.",
  "disabled": "Nocturne Web is turned off everywhere.",
  "idle": "Waiting for the page to load…",
};

const STAT_LABELS = [
  ["sheets", "Stylesheets darkened"], ["fetched", "Fetched from other sites"], ["unreadable", "Couldn't be read"],
  ["rules", "Rules copied"], ["variables", "CSS variables"], ["dropped", "Colours skipped"],
  ["inline", "Inline styles"], ["fixes", "Readability fixes"], ["buildMs", "Build time (ms)"],
];

async function main() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const settings = await browser.storage.local.get({ enabled: true, sites: {} });
  let host = null;
  try { host = new URL(tab.url).hostname; } catch (e) { /* not a web page */ }

  $("global").checked = settings.enabled !== false;
  $("global").addEventListener("change", () => browser.storage.local.set({ enabled: $("global").checked }).then(refresh));

  const setMode = async (mode) => {
    const { sites = {} } = await browser.storage.local.get("sites");
    if (mode === "auto") delete sites[host]; else sites[host] = mode;
    await browser.storage.local.set({ sites });
    setTimeout(refresh, 150);
  };
  $("site").addEventListener("change", () => setMode($("site").checked ? "auto" : "off"));
  $("force").addEventListener("click", () => setMode("on"));

  async function refresh() {
    let status = null;
    try { status = await browser.tabs.sendMessage(tab.id, { type: "status" }, { frameId: 0 }); } catch (e) { status = null; }
    const { sites = {}, enabled = true } = await browser.storage.local.get({ sites: {}, enabled: true });
    if (!host || !status) {
      $("host").textContent = host || "";
      $("status").textContent = "Nocturne Web can't run on this page. Browsers don't let extensions change built-in pages and add-on stores.";
      $("site").disabled = true;
      $("force").hidden = true;
      $("details").hidden = true;
      return;
    }
    $("host").textContent = host;
    $("site").disabled = !enabled;
    $("site").checked = (sites[host] || "auto") !== "off";
    $("status").textContent = STATUS_TEXT[status.state] || STATUS_TEXT.idle;
    $("force").hidden = status.state !== "already-dark";
    const dl = $("stats");
    dl.replaceChildren();
    for (const [key, label] of STAT_LABELS) {
      if (status[key] === undefined) continue;
      const dt = document.createElement("dt"); dt.textContent = label;
      const dd = document.createElement("dd"); dd.textContent = String(status[key]);
      dl.append(dt, dd);
    }
    $("details").hidden = !dl.children.length;
  }
  refresh();
}

main();
