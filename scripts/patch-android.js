// Patches the generated Android project: camera permission + app icon.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

// 1) camera permission
const p = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(p, 'utf8');
if (!x.includes('android.permission.CAMERA')) {
  x = x.replace('<application',
    '<uses-permission android:name="android.permission.CAMERA" />\n' +
    '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n' +
    '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />\n\n    <application');
  fs.writeFileSync(p, x); console.log('manifest patched');
}

// 2) app icon (legacy + round + adaptive foreground, blue background colour)
const res = 'android/app/src/main/res', src = path.join(root, 'assets', 'android');
if (fs.existsSync(src)) {
  for (const d of fs.readdirSync(src)) {
    const to = path.join(res, d); fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(path.join(src, d))) fs.copyFileSync(path.join(src, d, f), path.join(to, f));
  }
  fs.mkdirSync(path.join(res, 'values'), { recursive: true });
  fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1D4ED8</color>\n</resources>\n');
  console.log('app icon installed');
}
