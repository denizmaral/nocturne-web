"""Serves tests/pages on 127.0.0.1:8001 (pages) and :8002 (a second origin for stylesheets)."""
import http.server, os, threading

PAGES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=PAGES, **k)
    def log_message(self, *a): pass
    def end_headers(self):
        if self.path.startswith("/csp.html"): self.send_header("Content-Security-Policy", "style-src 'self'; script-src 'none'")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

def start():
    for port in (8001, 8002):
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()

if __name__ == "__main__":
    start(); print("serving", flush=True); threading.Event().wait()
