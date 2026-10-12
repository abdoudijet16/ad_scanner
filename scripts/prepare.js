// Copies OpenCV.js + jsPDF from node_modules into www/lib (so the app works fully offline).
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'www', 'lib');
fs.mkdirSync(out, { recursive: true });
const copy = (from, to) => { fs.copyFileSync(path.join(__dirname, '..', 'node_modules', from), path.join(out, to)); console.log('copied', to); };
copy('@techstark/opencv-js/dist/opencv.js', 'opencv.js');
copy('jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js');
