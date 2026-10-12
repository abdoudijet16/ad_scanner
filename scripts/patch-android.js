// Adds camera permissions to the generated Android project.
const fs = require('fs'), p = 'android/app/src/main/AndroidManifest.xml';
let x = fs.readFileSync(p, 'utf8');
if (!x.includes('android.permission.CAMERA')) {
  x = x.replace('<application',
    '<uses-permission android:name="android.permission.CAMERA" />\n' +
    '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n' +
    '    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />\n\n    <application');
  fs.writeFileSync(p, x); console.log('manifest patched');
}
