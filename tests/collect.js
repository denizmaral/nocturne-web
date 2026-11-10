// Runs in the test page: lists every visible text run (including inside web components)
// with its text and background colour.
return (() => {
  const rgba = (s) => { const m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1] : null; };
  const closed = window.__closedRoots || [];
  const shadowOf = (el) => el.shadowRoot || closed.find((r) => r.host === el) || null;
  const parentOf = (e) => e.assignedSlot || e.parentElement || (e.getRootNode().host || null);
  const runs = [];
  const visit = (node) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const t = n.data.trim();
        const el = n.parentElement;
        if (!t || !el || el.closest("style,script,title")) continue;
        let bg = null, image = false;
        for (let e = el; e; e = parentOf(e)) {
          const cs = getComputedStyle(e);
          if (cs.backgroundImage !== "none") {
            if (!cs.backgroundImage.includes("gradient")) { image = true; break; }
            bg = rgba(cs.backgroundImage.match(/rgba?\([^)]*\)/)[0]); break;
          }
          const c = rgba(cs.backgroundColor);
          if (c && c[3] > 0.5) { bg = c; break; }
        }
        if (!bg && !image) bg = [255, 255, 255, 1];
        runs.push({ t: t.slice(0, 40), fg: rgba(getComputedStyle(el).color), bg, image, link: !!el.closest("a") });
      } else if (n.nodeType === 1) {
        const sr = shadowOf(n);
        if (sr) visit(sr);
        visit(n);
      }
    }
  };
  visit(document.body);
  const svg = (sel) => { const e = document.querySelector(sel); return e ? rgba(getComputedStyle(e).fill) : null; };
  const photo = document.getElementById("photo");
  return {
    runs,
    gate: document.documentElement.hasAttribute("data-nocturne-web"),
    icon: svg("#icon path"), art: [...document.querySelectorAll("#art rect")].map((r) => rgba(getComputedStyle(r).fill)),
    photoFilter: photo ? getComputedStyle(photo).filter : null,
    placeholder: !!document.getElementById("nocturne-web-placeholder"),
    frames: document.documentElement.getAttribute("data-frames"),
  };
})();
