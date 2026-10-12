/* scanner.js - document scanning pipeline on OpenCV.js (needs global `cv`).
   All functions take/return cv.Mat; callers own (and must .delete()) what is returned. */
(function (root) {
  const PAGE_MM = { A4: [210, 297], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };

  function orderPts(p) {
    const s = p.map(a => a[0] + a[1]), d = p.map(a => a[1] - a[0]);
    return [p[s.indexOf(Math.min(...s))], p[d.indexOf(Math.min(...d))],
            p[s.indexOf(Math.max(...s))], p[d.indexOf(Math.max(...d))]]; // TL TR BR BL
  }
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const withTrash = fn => { const t = []; const T = m => (t.push(m), m);
    try { return fn(T); } finally { t.forEach(m => { try { m.delete(); } catch (e) {} }); } };

  /* ---------- corner detection: returns [[x,y]*4] normalized ---------- */
  function detectCorners(src) {
    return withTrash(T => {
      const sc = 800 / Math.max(src.rows, src.cols);
      const small = T(new cv.Mat());
      cv.resize(src, small, new cv.Size(Math.round(src.cols * sc), Math.round(src.rows * sc)), 0, 0, cv.INTER_AREA);
      const sw = small.cols, sh = small.rows, total = sw * sh;
      const g = T(new cv.Mat());
      cv.cvtColor(small, g, small.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY);
      cv.GaussianBlur(g, g, new cv.Size(7, 7), 0);

      const m1 = T(new cv.Mat()); cv.Canny(g, m1, 30, 120);
      cv.dilate(m1, m1, T(cv.Mat.ones(5, 5, cv.CV_8U)), new cv.Point(-1, -1), 2);
      const m2 = T(new cv.Mat()); cv.threshold(g, m2, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      cv.morphologyEx(m2, m2, cv.MORPH_CLOSE, T(cv.Mat.ones(15, 15, cv.CV_8U)));

      let fallback = null;
      for (const m of [m1, m2]) {
        const cnts = T(new cv.MatVector()), hier = T(new cv.Mat());
        cv.findContours(m, cnts, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
        const list = [];
        for (let i = 0; i < cnts.size(); i++) { const c = cnts.get(i); list.push({ c, a: cv.contourArea(c) }); }
        list.sort((x, y) => y.a - x.a);
        for (const { c, a } of list.slice(0, 6)) {
          if (a < 0.15 * total) break;
          if (a > 0.98 * total) continue;
          const hull = T(new cv.Mat()), ap = T(new cv.Mat());
          cv.convexHull(c, hull, false, true);
          cv.approxPolyDP(hull, ap, 0.02 * cv.arcLength(hull, true), true);
          if (ap.rows === 4) {
            const d = ap.data32S, pts = [[d[0], d[1]], [d[2], d[3]], [d[4], d[5]], [d[6], d[7]]];
            return orderPts(pts).map(([x, y]) => [clamp01(x / sw), clamp01(y / sh)]);
          }
          if (!fallback) fallback = cv.RotatedRect.points(cv.minAreaRect(c)).map(p => [p.x, p.y]);
        }
        list.forEach(o => o.c.delete());
      }
      if (fallback) return orderPts(fallback).map(([x, y]) => [clamp01(x / sw), clamp01(y / sh)]);
      return [[0.03, 0.03], [0.97, 0.03], [0.97, 0.97], [0.03, 0.97]];
    });
  }

  /* ---------- perspective flatten ---------- */
  const RATIO = { A4: 297 / 210, Letter: 279.4 / 215.9, Legal: 355.6 / 215.9 };
  // shape: 'natural' | 'snap' (snap to A4/Letter if within 10%) | 'A4' | 'Letter' | 'Legal'
  function warp(src, corners, shape) {
    return withTrash(T => {
      const w = src.cols, h = src.rows;
      const p = orderPts(corners.map(([x, y]) => [x * w, y * h]));
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      let W = Math.max(10, Math.round(Math.max(dist(p[2], p[3]), dist(p[1], p[0]))));
      let H = Math.max(10, Math.round(Math.max(dist(p[1], p[2]), dist(p[0], p[3]))));
      let target = null;
      const q = Math.max(W, H) / Math.min(W, H);
      if (RATIO[shape]) target = RATIO[shape];
      else if (shape === 'snap') {
        const best = ['A4', 'Letter'].map(k => RATIO[k]).sort((a, b) => Math.abs(a - q) - Math.abs(b - q))[0];
        if (Math.abs(best - q) / best < 0.10) target = best;
      }
      if (target) { if (H >= W) W = Math.round(H / target); else H = Math.round(W / target); }
      const a = T(cv.matFromArray(4, 1, cv.CV_32FC2, p.flat()));
      const b = T(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W - 1, 0, W - 1, H - 1, 0, H - 1]));
      const M = T(cv.getPerspectiveTransform(a, b));
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(W, H), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
      return dst;
    });
  }

  function capEdge(src, maxEdge) {
    const m = Math.max(src.cols, src.rows);
    if (m <= maxEdge) return src.clone();
    const s = maxEdge / m, d = new cv.Mat();
    cv.resize(src, d, new cv.Size(Math.round(src.cols * s), Math.round(src.rows * s)), 0, 0, cv.INTER_AREA);
    return d;
  }

  /* ---------- auto straighten (projection profile) ---------- */
  function deskew(src, limit = 10) {
    return withTrash(T => {
      const g = T(new cv.Mat());
      if (src.channels() === 1) src.copyTo(g); else cv.cvtColor(src, g, cv.COLOR_RGB2GRAY);
      const sc = Math.min(1, 700 / Math.max(g.cols, g.rows));
      const gs = T(new cv.Mat());
      cv.resize(g, gs, new cv.Size(Math.round(g.cols * sc), Math.round(g.rows * sc)), 0, 0, cv.INTER_AREA);
      cv.GaussianBlur(gs, gs, new cv.Size(3, 3), 0);
      const bwFull = T(new cv.Mat());
      cv.threshold(gs, bwFull, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const mx = Math.round(bwFull.cols * .04), my = Math.round(bwFull.rows * .04);
      const bw = T(bwFull.roi(new cv.Rect(mx, my, bwFull.cols - 2 * mx, bwFull.rows - 2 * my)).clone());
      if (cv.countNonZero(bw) < 50) return src.clone();
      const rotM = a => cv.getRotationMatrix2D(new cv.Point(bw.cols / 2, bw.rows / 2), a, 1);
      const r = T(new cv.Mat()), rs = T(new cv.Mat());
      const score = a => {
        const M = rotM(a);
        cv.warpAffine(bw, r, M, new cv.Size(bw.cols, bw.rows)); M.delete();
        cv.reduce(r, rs, 1, cv.REDUCE_SUM, cv.CV_32F);
        const d = rs.data32F; let mean = 0; for (let i = 0; i < d.length; i++) mean += d[i]; mean /= d.length;
        let v = 0; for (let i = 0; i < d.length; i++) v += (d[i] - mean) ** 2; return v / d.length;
      };
      let best = 0, bs = -1;
      for (let a = -limit; a <= limit + 1e-6; a += .5) { const s = score(a); if (s > bs) { bs = s; best = a; } }
      const c = best; bs = -1;
      for (let a = c - .5; a <= c + .5 + 1e-6; a += .1) { const s = score(a); if (s > bs) { bs = s; best = a; } }
      if (Math.abs(best) < .15) return src.clone();
      const M = T(cv.getRotationMatrix2D(new cv.Point(src.cols / 2, src.rows / 2), best, 1));
      const dst = new cv.Mat();
      cv.warpAffine(src, dst, M, new cv.Size(src.cols, src.rows), cv.INTER_CUBIC, cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255));
      return dst;
    });
  }

  /* ---------- enhancement ---------- */
  function removeShadow(src) {
    return withTrash(T => {
      const w = src.cols, h = src.rows, sc = Math.min(1, 400 / Math.max(w, h));
      const inV = T(new cv.MatVector()), outV = new cv.MatVector();
      cv.split(src, inV);
      const k = T(cv.Mat.ones(5, 5, cv.CV_8U));
      for (let i = 0; i < inV.size(); i++) {
        const c = inV.get(i), sm = new cv.Mat(), bg = new cv.Mat(), d = new cv.Mat();
        cv.resize(c, sm, new cv.Size(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc))), 0, 0, cv.INTER_AREA);
        cv.dilate(sm, sm, k); cv.medianBlur(sm, sm, 21);
        cv.resize(sm, bg, new cv.Size(w, h), 0, 0, cv.INTER_LINEAR);
        cv.absdiff(c, bg, d); cv.bitwise_not(d, d);
        cv.normalize(d, d, 0, 255, cv.NORM_MINMAX);
        outV.push_back(d);
        c.delete(); sm.delete(); bg.delete(); d.delete();
      }
      const dst = new cv.Mat();
      if (outV.size() === 1) outV.get(0).copyTo(dst); else cv.merge(outV, dst);
      outV.delete();
      return dst;
    });
  }

  function whitePoint(img) { // scales so the paper (80th percentile) becomes pure white, in place
    const g = new cv.Mat();
    if (img.channels() === 1) img.copyTo(g); else cv.cvtColor(img, g, cv.COLOR_RGB2GRAY);
    const hist = new Array(256).fill(0), d = g.data; let n = 0;
    for (let i = 0; i < d.length; i += 7) { hist[d[i]]++; n++; }
    g.delete();
    let acc = 0, p = 255; for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * .8) { p = i; break; } }
    if (p >= 250 || p < 30) return;
    img.convertTo(img, -1, 255 / p, 0);
  }

  /* s: {filter,shadow,whitepoint,deskew,brightness,contrast,sharpen,denoise,crop,block,C,despeckle,rotate}
     src: RGBA or RGB Mat (flattened). Returns 1-channel (gray/bw) or 3-channel RGB Mat. */
  function process(src, s) {
    let img = new cv.Mat();
    if (src.channels() === 4) cv.cvtColor(src, img, cv.COLOR_RGBA2RGB); else src.copyTo(img);
    const swap = n => { img.delete(); img = n; };

    const rot = ((+s.rotate || 0) % 360 + 360) % 360;
    if (rot) { const d = new cv.Mat();
      cv.rotate(img, d, rot === 90 ? cv.ROTATE_90_CLOCKWISE : rot === 180 ? cv.ROTATE_180 : cv.ROTATE_90_COUNTERCLOCKWISE); swap(d); }
    const c = (+s.crop || 0) / 100;
    if (c > 0) { const dx = Math.round(img.cols * c), dy = Math.round(img.rows * c);
      swap(img.roi(new cv.Rect(dx, dy, img.cols - 2 * dx, img.rows - 2 * dy)).clone()); }
    if (s.deskew) swap(deskew(img));
    if (s.denoise > 0) { const d = new cv.Mat();
      cv.bilateralFilter(img, d, 7, s.denoise * 8, s.denoise * 2); swap(d); }

    const f = s.filter;
    if (f === 'gray' || f === 'bw') { const d = new cv.Mat(); cv.cvtColor(img, d, cv.COLOR_RGB2GRAY); swap(d); }
    if (f !== 'color' && s.shadow) swap(removeShadow(img));
    if (f !== 'bw' && s.whitepoint) whitePoint(img);

    cv.convertScaleAbs(img, img, s.contrast / 100, s.brightness);
    const rel = Math.max(img.cols, img.rows) / 1400;
    if (s.sharpen > 0) { const amt = s.sharpen / 100, bl = new cv.Mat();
      cv.GaussianBlur(img, bl, new cv.Size(0, 0), Math.max(.8, 2 * rel));
      cv.addWeighted(img, 1 + amt, bl, -amt, 0, img); bl.delete(); }
    if (f === 'bw') {
      const bs = Math.max(11, Math.round(s.block * rel) | 1);
      cv.adaptiveThreshold(img, img, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, bs, s.C);
      if (s.despeckle) cv.medianBlur(img, img, 3);
    }
    return img;
  }

  root.Scan = { detectCorners, warp, capEdge, process, PAGE_MM, orderPts };
})(typeof window !== 'undefined' ? window : globalThis);
