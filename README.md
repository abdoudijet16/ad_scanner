# ماسح الملفات (Doc Scanner)

Photo → scanner-style PDF. Camera or gallery input, auto edge detection, draggable corners, perspective fix,
shadow removal, B&W / grayscale / magic colour, auto-straighten, multi-page PDF. Fully offline (OpenCV.js + jsPDF).

One web UI (`www/`) runs in:
* **Android APK** – Capacitor (Android System WebView). Built automatically by GitHub Actions.
* **Windows** – `python windows_webview2.py` (Microsoft WebView2)
* any browser – `npm run serve`

## Get the APK
1. Create a GitHub repo and upload everything in this folder (keep `.github/workflows/build-apk.yml`).
2. Open the **Actions** tab → **Build APK** (runs on every push, or press *Run workflow*).
3. Download `DocScanner-apk` from the run (or from **Releases → latest**), unzip, install `app-debug.apk`
   (allow "install unknown apps").
