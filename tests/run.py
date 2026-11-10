"""End-to-end tests in a real Gecko browser (Zen or Firefox), headless.

Each test page is loaded twice: without the extension (the original look) and with it.
Every text run must come out as the dark version of its original colours (same engine as
color.js), keep readable contrast, and images must be untouched.

    python3 tests/run.py [path/to/zen-or-firefox]
"""
import json, os, sys, time, zipfile
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import server

BROWSER = sys.argv[1] if len(sys.argv) > 1 else "/Applications/Zen.app/Contents/MacOS/zen"
PAGES = {"classes": 1.5, "vars": 1.5, "cross": 2.0, "inline": 1.5, "dark": 1.5, "dynamic": 3.5, "csp": 1.5}
COLLECT = open(os.path.join(HERE, "collect.js")).read()
COLOR_JS = open(os.path.join(ROOT, "src", "color.js")).read()

def build_xpi():
    path = os.path.join(HERE, ".build", "nocturne-web-test.xpi")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with zipfile.ZipFile(path, "w") as z:
        for top in ["manifest.json", "src", "popup", "icons"]:
            full = os.path.join(ROOT, top)
            if os.path.isfile(full): z.write(full, top)
            else:
                for d, _, files in os.walk(full):
                    for f in files: z.write(os.path.join(d, f), os.path.relpath(os.path.join(d, f), ROOT))
    return path

def collect_all(with_extension):
    o = Options(); o.binary_location = BROWSER; o.add_argument("-headless")
    d = webdriver.Firefox(options=o)
    d.set_window_size(1000, 900)
    try:
        if with_extension: d.install_addon(build_xpi(), temporary=True); time.sleep(0.5)
        out = {}
        for page, wait in PAGES.items():
            d.get(f"http://127.0.0.1:8001/{page}.html"); time.sleep(wait)
            out[page] = d.execute_script(COLLECT)
        expected = None
        if with_extension:
            d.get("http://127.0.0.1:8001/classes.html")
            out["_adjust"] = d.execute_script(COLOR_JS + """
              const {Color} = globalThis.NocturneColor;
              const f = (c, role) => { const x = new Color(c[0]/255, c[1]/255, c[2]/255, c[3]).adjusted(role); return [...x.bytes, x.a]; };
              const pages = arguments[0], res = {};
              for (const [p, data] of Object.entries(pages)) res[p] = data.runs.map(r => ({fg: f(r.fg, 'text'), bg: r.bg && f(r.bg, 'bg')}));
              res._icon = arguments[1] && f(arguments[1], 'text');
              return res;""", BEFORE, BEFORE["inline"]["icon"])
        return out
    finally:
        d.quit()

def close(a, b, tol=3): return a is not None and b is not None and all(abs(x - y) <= tol for x, y in zip(a[:3], b[:3]))

def lum(c):
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (x / 255 for x in c[:3]); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def contrast(a, b):
    x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)

server.start()
BEFORE = collect_all(False)
AFTER = collect_all(True)
ADJ = AFTER.pop("_adjust")
failures = 0
for page in PAGES:
    b, a, issues = BEFORE[page], AFTER[page], []
    if page == "dark":
        if a["gate"]: issues.append("already-dark page was darkened")
        if [r["fg"] for r in a["runs"]] != [r["fg"] for r in b["runs"]]: issues.append("already-dark page colours changed")
    else:
        if not a["gate"]: issues.append("gate attribute not set")
        if len(a["runs"]) != len(b["runs"]): issues.append(f"run count {len(a['runs'])} vs {len(b['runs'])}")
        for rb, ra, exp in zip(b["runs"], a["runs"], ADJ[page]):
            t = ra["t"]
            if rb["image"]:
                if not close(ra["fg"], rb["fg"], 0): issues.append(f"'{t}': text on an image background changed {rb['fg']} -> {ra['fg']}")
                continue
            if not close(ra["bg"], exp["bg"]): issues.append(f"'{t}': bg {ra['bg'][:3]} expected {exp['bg'][:3]} (was {rb['bg'][:3]})")
            if not rb["link"] and not close(ra["fg"], exp["fg"]): issues.append(f"'{t}': fg {ra['fg'][:3]} expected {exp['fg'][:3]} (was {rb['fg'][:3]})")
            cb, ca = contrast(rb["fg"], rb["bg"]), contrast(ra["fg"], ra["bg"])
            if ca < 4.5 and ca < cb - 0.5: issues.append(f"'{t}': contrast {cb:.1f} -> {ca:.1f}")
    if page == "inline":
        if not close(a["icon"], ADJ["_icon"]): issues.append(f"icon fill {a['icon']} expected {ADJ['_icon']}")
        if a["art"] != b["art"]: issues.append("multi-colour SVG illustration was recoloured")
    if page == "classes" and a["photoFilter"] not in (None, "none"): issues.append("image has a filter")
    failures += bool(issues)
    print(("PASS " if not issues else "FAIL ") + page + "".join("\n   " + i for i in issues))
print("ALL PASS" if not failures else f"{failures} page(s) failed")
sys.exit(1 if failures else 0)
