"""Run the same web UI in a Windows desktop window (Microsoft WebView2).
   Setup once:   npm install && node scripts/prepare.js && pip install pywebview
   Run:          python windows_webview2.py
"""
import functools, http.server, os, threading, webview

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www")
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()  # localhost = secure context -> camera works

webview.create_window("ماسح الملفات", "http://127.0.0.1:8765/index.html", width=1450, height=880, min_size=(380, 600))
webview.start(gui="edgechromium")  # WebView2
