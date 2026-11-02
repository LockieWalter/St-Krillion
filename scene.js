"use strict";

/* ------------------------------------------------------------------ *
 *  Pixel art for Building Jerusillion.
 *
 *  The page sits in front of one tall pixel world. At the bottom is
 *  the quad at St Paul's on a sunny day, framed by two jacarandas.
 *  Climbing reveals Sydney Uni and the city behind it, then the clouds,
 *  a sunset, the night sky and, right at the top, a golden Jerusalem.
 *  Your score is your altitude.
 *
 *  Also in here: the tier icons and the balloon.
 * ------------------------------------------------------------------ */

const Pixel = (() => {
  const K = 3;     // world rows per metre climbed
  const TOP = 500; // metres at the summit

  const C = {
    stoneHi: "#f3d9a4", stone: "#ddb67b", stoneMid: "#c89c5e", stoneLo: "#a97b44", stoneDk: "#6f4a26",
    slateHi: "#6a6f88", slate: "#4d5168", slateDk: "#363a4e",
    glass: "#2f4670", glassHi: "#86b6e0",
    door: "#7a1630",
    lawnHi: "#6aab45", lawn: "#57963a", lawnLo: "#477f2f", lawnDk: "#35631f",
    trunk: "#4b3324",
    jacHi: "#c2adf5", jac1: "#9d82e2", jac2: "#7c62c9", jac3: "#5a43a3",
    maroon: "#8a1a36", maroonDk: "#5a0d22", gold: "#f2c14e", goldHi: "#ffe48a", goldDk: "#b5841f",
    ibis: "#f4f1ea", ibisDk: "#1e1b1a",
    ink: "#2a0610",
  };

  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Seeded random, so the world comes out the same on every load.
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  const hexes = new Map();
  function rgb(c) {
    let v = hexes.get(c);
    if (!v) {
      const n = parseInt(c.slice(1), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      hexes.set(c, v);
    }
    return v;
  }

  function mixHex(a, b, t) {
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    const h = (v) => Math.round(v).toString(16).padStart(2, "0");
    return "#" + h(lerp(r1, r2, t)) + h(lerp(g1, g2, t)) + h(lerp(b1, b2, t));
  }

  // An RGBA pixel buffer that turns into a canvas.
  function raster(w, h) {
    const img = new ImageData(w, h);
    const d = img.data;
    const r = {
      w, h,
      px(x, y, c) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (!c || x < 0 || y < 0 || x >= w || y >= h) return;
        const [cr, cg, cb] = rgb(c);
        const i = (y * w + x) * 4;
        d[i] = cr;
        d[i + 1] = cg;
        d[i + 2] = cb;
        d[i + 3] = 255;
      },
      has(x, y) {
        return x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
      },
      rect(x, y, rw, rh, c) {
        for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) r.px(x + i, y + j, c);
      },
      canvas() {
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").putImageData(img, 0, 0);
        return cv;
      },
    };
    return r;
  }

  /* ----------------------------- shapes ----------------------------- */

  // Gothic pointed arch: rows widen 1 → 3 → 5 … (2 → 4 … if even) to full width.
  function arch(r, x, y, w, h, c) {
    for (let j = 0; j < h; j++) {
      const span = Math.min(w, (w % 2 ? 1 : 2) + j * 2);
      r.rect(x + ((w - span) >> 1), y + j, span, 1, c);
    }
  }

  function disc(r, cx, cy, rad, c) {
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad; x <= rad; x++) {
        if (x * x + y * y <= rad * rad + rad * 0.8) r.px(cx + x, cy + y, c);
      }
    }
  }

  // Sandstone blocks: coursing every 4 rows, staggered joints.
  function stonePx(r, x, y, g, P = C) {
    const k = g - y;
    const course = k % 4 === 0;
    const joint = (x + ((k >> 2) & 1) * 3) % 7 === 0;
    let c = P.stone;
    if (course && bayer(x, y) < 0.55) c = P.stoneMid;
    else if (joint && bayer(x, y) < 0.4) c = P.stoneMid;
    r.px(x, y, c);
  }

  function ashlar(r, x, y, w, h, g, P = C) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) stonePx(r, x + i, y + j, g, P);
  }

  function lancet(r, x, y, w, h, P = C) {
    arch(r, x - 1, y - 1, w + 2, h + 1, P.stoneLo);
    arch(r, x, y, w, h, P.glass);
    r.px(x, y + 2, P.glassHi);
    r.rect(x - 1, y + h, w + 2, 1, P.stoneHi);
  }



  /* ------------------------ St Paul's, across the quad ---------------- */

  // Warm, weathered sandstone and pale slate, the way the quad looks on a sunny afternoon.
  const P = {
    stoneHi: "#ecc08f", stone: "#d49e68", stoneMid: "#c08956", stoneLo: "#a26d3f", stoneDk: "#6e4526", weather: "#b27a4a",
    slateHi: "#d3ccd3", slate: "#b5adb7", slateMid: "#a29aa6", slateDk: "#847d8b",
    glass: "#2c2f3d", glassHi: "#7d8cab", door: "#2e221d", pipe: "#4f3d33",
    leaf: "#3f7a3a", leafHi: "#5a9a48", leafDk: "#2c5a2c",
    bark: "#3b2d2b", barkHi: "#5b4744", jacDeep: "#46348a",
  };

  // Ashlar with a little weathering, so the walls aren't flat.
  function wall(r, x, y, w, h, g) {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const px = x + i;
        const py = y + j;
        const n = Math.sin(px * 0.37 + py * 0.11) + Math.sin(px * 0.13 - py * 0.29) + Math.sin((px + py) * 0.07);
        if (n > 1.6 && bayer(px, py) < 0.5) r.px(px, py, P.weather);
        else stonePx(r, px, py, g, P);
      }
    }
  }

  // A pitched slate roof seen side-on, from the eaves row up to the ridge.
  function roof(r, x0, x1, eave, ridge) {
    for (let y = eave; y >= ridge; y--) {
      const j = eave - y;
      for (let x = x0; x <= x1; x++) {
        let c = j % 3 === 0 || (x * 3 + (Math.floor(j / 3) & 1) * 2) % 5 === 0 ? P.slateMid : P.slate;
        if (y === ridge) c = P.slateHi;
        else if (j === 0) c = P.slateDk;
        r.px(x, y, c);
      }
    }
  }

  // A gable face rising from the eaves, with coping stones along both edges.
  function gable(r, cx, half, eave, rise, g) {
    for (let j = 0; j <= rise; j++) {
      const h = Math.round(half * (1 - j / rise));
      const y = eave - j;
      for (let i = -h - 1; i <= h + 1; i++) {
        if (i <= -h) r.px(cx + i, y, P.stoneHi);
        else if (i >= h) r.px(cx + i, y, P.stoneLo);
        else wall(r, cx + i, y, 1, 1, g);
      }
    }
    r.rect(cx, eave - rise - 2, 1, 2, P.stoneHi);
  }

  function chimney(r, x, top, base) {
    r.rect(x, top, 3, base - top, P.stone);
    r.rect(x, top, 1, base - top, P.stoneHi);
    r.rect(x + 2, top, 1, base - top, P.stoneLo);
    for (let y = top + 3; y < base; y += 4) r.rect(x + 1, y, 1, 1, P.stoneMid);
    r.rect(x - 1, top - 1, 5, 1, P.stoneHi);
    r.rect(x - 1, top, 5, 1, P.stoneLo);
    r.px(x + 1, top - 2, P.stoneDk);
  }

  // A group of narrow lancets. Each entry is [x] or [x, its own top].
  function lancets(r, xs, top, bottom) {
    for (const [x, t = top] of xs) lancet(r, x, t, 2, bottom - t, P);
  }

  /* ----------------------- the wings, in perspective ------------------ */

  // The two side wings run from the back corners of the quad out towards you.
  // Each screen column x sits at scale s (1 at the back corner, bigger as the
  // wall gets closer). u is the distance along the wall and v the height up it,
  // both in back-range pixels, so the wing faces are drawn by sampling (u, v).
  const EYE = 10; // eye height above the lawn, in back-range pixels

  // The right wing is on the shady side.
  const PS = { ...P, stoneHi: "#d9a676", stone: "#c08b5a", stoneMid: "#ab7a4c", stoneLo: "#8f6038", weather: "#a06d42" };

  function stoneAt(Q, u, v, x, y) {
    const course = Math.floor(v) % 4 === 0;
    const joint = (Math.floor(u) + ((Math.floor(v) >> 2) & 1) * 3) % 7 === 0;
    if ((course && bayer(x, y) < 0.55) || (joint && bayer(x, y) < 0.35)) return Q.stoneMid;
    const n = Math.sin(u * 0.37 + v * 0.11) + Math.sin(u * 0.13 - v * 0.29);
    return n > 1.5 && bayer(x, y) < 0.5 ? Q.weather : Q.stone;
  }

  // Inside a pointed lancet w wide, centred on uc, running from v0 up to v1?
  function inLancet(u, v, uc, w, v0, v1) {
    if (v < v0 || v > v1) return false;
    const taper = v > v1 - w ? (v1 - v) / w : 1;
    return Math.abs(u - uc) < (w / 2) * taper;
  }

  function slateAt(v, top, x, y) {
    if (v > top - 0.8) return P.slateHi;
    return Math.floor(v) % 3 === 0 || (x * 3 + y) % 7 === 0 ? P.slateMid : P.slate;
  }

  function glassAt(u, v, uc, v1) {
    return v > v1 - 2 && u < uc ? P.glassHi : P.glass;
  }

  // Left: the residential wing, two storeys and attic dormers, chimneys at both ends.
  function leftWing(u, v, x, y, len) {
    const Q = P;
    for (const cu of [7, len - 5]) {
      if (Math.abs(u - cu) < 2.2 && v >= 30 && v < 53) return v > 51.8 ? Q.stoneDk : v > 50.5 ? Q.stoneHi : u < cu - 1 ? Q.stoneHi : u > cu + 1.2 ? Q.stoneLo : Q.stone;
    }
    const dc = 14 + Math.round((u - 14) / 20) * 20;
    const du = Math.abs(u - dc);
    if (dc >= 14 && dc < len - 6 && du < 5 && v >= 31 && v < 47 - du * 1.4) {
      if (inLancet(u, v, dc - 1.4, 1.8, 33, 43) || inLancet(u, v, dc + 1.4, 1.8, 33, 43)) return glassAt(u, v, dc, 43);
      return du > 4 || v > 46 - du * 1.4 ? Q.stoneHi : stoneAt(Q, u, v, x, y);
    }
    if (v > 48) return null;
    if (v >= 35) return slateAt(v, 48, x, y);
    if (v > 34) return Q.stoneHi;
    const wc = 5 + Math.round((u - 5) / 10) * 10;
    for (const [v0, v1] of [[3, 12], [18, 28]]) {
      if (inLancet(u, v, wc - 1.4, 1.9, v0, v1) || inLancet(u, v, wc + 1.4, 1.9, v0, v1)) return glassAt(u, v, wc, v1);
    }
    if (Math.abs(v - 15.5) < 0.5) return Q.stoneHi;
    if (v < 1.5) return Q.stoneLo;
    if (u < 0.8) return Q.stoneLo;
    return stoneAt(Q, u, v, x, y);
  }

  // Right: the cloister arcade, then the chapel with its great traceried windows.
  function rightWing(u, v, x, y, len) {
    const Q = PS;
    const split = Math.max(14, len * 0.45);
    if (u < split) {
      const bu = Math.round(u / 9) * 9;
      if (bu > 0 && Math.abs(u - bu) < 0.9) {
        if (v < 37) return u < bu ? Q.stoneHi : Q.stoneLo;
        if (v < 43 - Math.abs(u - bu) * 4) return Q.stoneHi;
      }
      if (v > 46) return null;
      if (v >= 36) return slateAt(v, 46, x, y);
      if (v >= 34) return Math.floor(u) % 3 < 2 || v < 35 ? Q.stoneHi : null;
      const ac = Math.floor(u / 9) * 9 + 4.5;
      if (inLancet(u, v, ac, 6, 0, 13)) return v > 11 ? Q.stoneDk : P.door;
      if (inLancet(u, v, ac, 2, 19, 30)) return glassAt(u, v, ac, 30);
      if (Math.abs(v - 15.5) < 0.5) return Q.stoneHi;
      if (v < 1.5) return Q.stoneLo;
      return stoneAt(Q, u, v, x, y);
    }
    // a cross on the chapel's far end
    if (u > len - 4 && ((Math.abs(u - (len - 2.5)) < 0.5 && v >= 56 && v < 63) || (Math.abs(v - 60) < 0.6 && Math.abs(u - (len - 2.5)) < 1.8))) return Q.stoneHi;
    const ch = u - split;
    const bu = split + Math.round(ch / 13) * 13;
    if (Math.abs(u - bu) < 1.1) {
      if (v < 44) return u < bu ? Q.stoneHi : Q.stoneLo;
      if (v < 52 - Math.abs(u - bu) * 5) return Q.stoneHi;
    }
    if (v > 57) return null;
    if (v >= 44) return slateAt(v, 57, x, y);
    if (v > 43) return Q.stoneHi;
    const wc = split + Math.floor(ch / 13) * 13 + 6.5;
    if (inLancet(u, v, wc, 8, 7, 40)) {
      const du = u - wc;
      const ring = Math.hypot(du, v - 35.5);
      if (Math.abs(du) < 0.45 || (v < 31 && Math.abs(Math.abs(du) - 2.1) < 0.4) || Math.abs(v - 21) < 0.5) return Q.stoneLo;
      if (ring > 1 && ring < 1.8) return Q.stoneLo;
      const k = bayer(x, y);
      return k < 0.08 ? "#b0465a" : k < 0.15 ? "#5a7fb8" : k < 0.19 ? "#d8b45a" : P.glass;
    }
    if (Math.abs(v - 5.5) < 0.5) return Q.stoneHi;
    if (v < 1.5) return Q.stoneLo;
    return stoneAt(Q, u, v, x, y);
  }

  // Draw one wing. Returns nothing; the lawn is laid afterwards below groundAt().
  function wing(r, cx, g, half, side) {
    const sEdge = (side < 0 ? cx + 0.5 : r.w - cx - 0.5) / half;
    const len = 2 * half * (1 - 1 / sEdge);
    const x0 = side < 0 ? 0 : cx + half + 1;
    const x1 = side < 0 ? cx - half - 1 : r.w - 1;
    for (let x = x0; x <= x1; x++) {
      const s = Math.abs(x + 0.5 - (cx + 0.5)) / half;
      const u = 2 * half * (1 - 1 / s);
      const top = Math.floor(g - EYE + (EYE - 64) * s);
      const base = groundAt(x, cx, g, half);
      for (let y = top; y <= base; y++) {
        const v = EYE - (y + 0.5 - g + EYE) / s;
        const c = side < 0 ? leftWing(u, v, x, y, len) : rightWing(u, v, x, y, len);
        if (c) r.px(x, y, c);
      }
    }
  }

  // Where the lawn meets the buildings: flat along the back range, sloping down the wings.
  function groundAt(x, cx, g, half) {
    const s = Math.abs(x + 0.5 - (cx + 0.5)) / half;
    return s <= 1 ? g - 1 : Math.round(g - EYE + EYE * s) - 1;
  }

  // A dark green tree peeking over the roof.
  function greenTree(r, x, cy, R, rand) {
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R - 2; dx <= R + 2; dx++) {
        const d = Math.hypot(dx / 1.2, dy) + (rand() - 0.5) * 1.6;
        if (d > R) continue;
        const s = -dx / R - dy / R + (rand() - 0.5) * 0.8;
        r.px(x + dx, cy + dy, s > 0.7 ? P.leafHi : s > -0.4 ? P.leaf : P.leafDk);
      }
    }
  }

  // St Paul's quad. The back range has a central gable, two tall chimneys and
  // gabled dormers, and grows extra bays on wide screens; the wings wrap round
  // towards you on either side. Symmetric about cx; g is the ground.
  function college(r, cx, g, half, rand) {
    wing(r, cx, g, half, -1);
    wing(r, cx, g, half, 1);

    greenTree(r, cx - 27, g - 50, 9, rand);
    roof(r, cx - half, cx + half, g - 35, g - 49);
    for (const s of [-1, 1]) chimney(r, cx + s * 15 - 1, g - 67, g - 48);

    wall(r, cx - half, g - 34, half * 2 + 1, 34, g);
    r.rect(cx - half, g - 34, half * 2 + 1, 1, P.stoneHi);
    r.rect(cx - half, g - 18, half * 2 + 1, 1, P.stoneHi);
    r.rect(cx - half, g - 17, half * 2 + 1, 1, P.stoneLo);
    r.rect(cx - half, g - 2, half * 2 + 1, 2, P.stoneLo);

    for (const s of [-1, 1]) {
      for (let d = 23; d + 7 <= half; d += 26) {
        // gabled dormers with paired lancets breaking the eaves, a triplet below
        const dx = cx + s * d;
        wall(r, dx - 6, g - 40, 13, 6, g);
        gable(r, dx, 6, g - 41, 8, g);
        lancets(r, [[dx - 2], [dx + 1]], g - 42, g - 27);
        lancets(r, [[dx - 4], [dx - 1], [dx + 2]], g - 14, g - 4);
        if (d + 10 <= half) {
          r.rect(dx + s * 9, g - 34, 1, 34, P.pipe);
          r.rect(dx + s * 9 - (s < 0 ? 1 : 0), g - 34, 2, 2, P.pipe);
        }
      }
      for (let d = 36; d + 4 <= half; d += 26) {
        const p = cx + s * d;
        lancets(r, [[p - 2], [p + 1]], g - 14, g - 4);
        lancets(r, [[p - 2], [p + 1]], g - 30, g - 21);
      }
    }

    // the central gable bay, a touch proud of the range
    wall(r, cx - 12, g - 34, 25, 34, g);
    r.rect(cx - 13, g - 34, 1, 34, P.stoneHi);
    r.rect(cx + 13, g - 34, 1, 34, P.stoneLo);
    r.rect(cx - 13, g - 18, 27, 1, P.stoneHi);
    r.rect(cx - 13, g - 17, 27, 1, P.stoneLo);
    r.rect(cx - 13, g - 2, 27, 2, P.stoneLo);
    gable(r, cx, 12, g - 35, 24, g);
    lancets(r, [[cx - 5, g - 36], [cx - 2, g - 39], [cx + 1, g - 39], [cx + 4, g - 36]], 0, g - 22);
    arch(r, cx - 4, g - 15, 9, 15, P.stoneLo);
    arch(r, cx - 3, g - 14, 7, 14, P.door);
    r.rect(cx - 5, g - 1, 11, 1, P.stoneHi);
  }

  /* ---------------------- the lawn and the jacarandas ---------------- */

  function line(x0, y0, x1, y1, fn) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n));
  }

  // One of the two big jacarandas: a broad, lumpy canopy in full bloom,
  // dark boughs showing through underneath. x is the trunk, g the ground.
  function bigJacaranda(r, x, g, rx, ry, rand) {
    const th = Math.round(ry * 0.5);
    const cy = g - th - ry + 2;
    const clumps = [[0, 0, rx * 0.5]];
    for (let i = 0; i < 28; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.78;
      clumps.push([Math.cos(a) * d * rx, Math.sin(a) * d * ry * 0.85, (0.2 + rand() * 0.15) * rx]);
    }
    const inside = (dx, dy) => clumps.some(([bx, by, br]) => (dx - bx) ** 2 + (dy - by) ** 2 <= br * br);
    const boughs = [-150, -125, -100, -78, -55, -32].map((deg) => {
      const a = ((deg + (rand() - 0.5) * 14) * Math.PI) / 180;
      const len = rx * (0.5 + rand() * 0.3);
      return [x + 1 + Math.cos(a) * len, g - th + 2 + Math.sin(a) * len * 0.9];
    });

    // trunk and boughs
    r.rect(x, g - th, 3, th, P.bark);
    r.rect(x, g - th, 1, th, P.barkHi);
    r.px(x - 1, g - 1, P.bark);
    r.px(x + 3, g - 1, P.bark);
    for (const [bx, by] of boughs) line(x + 1, g - th + 2, bx, by, (px, py) => { r.px(px, py, P.bark); r.px(px, py + 1, P.bark); });

    // the bloom
    for (let dy = -ry - 6; dy <= ry + 4; dy++) {
      for (let dx = -rx - 6; dx <= rx + 6; dx++) {
        if (!inside(dx, dy)) continue;
        const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
        if (edge && rand() < 0.3) continue;
        // little gaps in the bloom: sky along the top, shadow lower down
        const px = x + 1 + dx;
        const py = cy + dy;
        const far = (dx / rx) ** 2 + (dy / ry) ** 2;
        if (far > 0.35 && Math.sin(px * 0.9 + py * 0.5) + Math.sin(px * 0.31 - py * 0.77) > 1.5 - far * 0.4) {
          if (dy > -ry * 0.45) r.px(px, py, P.jacDeep);
          continue;
        }
        let hl = -1;
        for (const [bx, by, br] of clumps) {
          if ((dx - bx) ** 2 + (dy - by) ** 2 <= br * br) hl = Math.max(hl, (by - dy) / br);
        }
        const s = (-dx / rx) * 0.35 - (dy / ry) * 0.55 + hl * 0.6 + (rand() - 0.5) * 0.45;
        const c = edge && s < 0.2 ? C.jac3 : s > 0.85 ? C.jacHi : s > 0.3 ? C.jac1 : s > -0.25 ? C.jac2 : s > -0.7 ? C.jac3 : P.jacDeep;
        r.px(px, py, c);
      }
    }
    // boughs showing through the shadowed underside
    for (const [bx, by] of boughs) {
      line(x + 1, g - th + 2, bx, by, (px, py) => { if (py > cy + 2 && bayer(px, py) < 0.6) r.px(px, py, P.bark); });
    }
  }

  // Distance from (px, py) to the segment from (ax, ay) to (bx, by).
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Sandstone paving: two paths fan out from the front door to the corners,
  // meeting a straight path across the front of the lawn.
  function footpaths(r, cx, g, half) {
    const cross = g + 40;
    for (let y = g; y < r.h; y++) {
      const depth = clamp((y - g) / (cross - g), 0, 1);
      const w = 1.2 + depth * 2.3; // paths widen as they come towards you
      for (let x = 0; x < r.w; x++) {
        if (y <= groundAt(x, cx, g, half)) continue;
        const d = Math.min(segDist(x, y, cx - 2, g, -1, cross), segDist(x, y, cx + 2, g, r.w, cross));
        const across = Math.abs(y - cross);
        let edge;
        if (d < w) edge = d > w - 0.9;
        else if (across <= 2.5) edge = across > 1.6;
        else continue;
        r.px(x, y, edge ? "#b39d74" : bayer(x * 3, y) < 0.2 ? "#c9b185" : "#dcc69c");
      }
    }
  }

  // A wooden slatted bench with iron legs, about 11 wide; (x, y) is its top-left.
  function bench(r, x, y) {
    const wood = "#9a6338";
    r.rect(x + 1, y, 9, 1, "#b07444");
    r.rect(x + 1, y + 1, 9, 1, "#5e3a20");
    r.rect(x + 1, y + 2, 9, 1, wood);
    r.rect(x, y + 3, 11, 1, "#c08552");
    r.rect(x, y + 4, 11, 1, "#5e3a20");
    for (const lx of [x + 1, x + 9]) {
      r.rect(lx, y, 1, 7, "#2f2622");
    }
    r.px(x + 1, y + 6, "#2f2622");
    r.px(x + 9, y + 6, "#2f2622");
  }

  // The near layer: the quad wrapped around its lawn, the footpaths, and the two jacarandas.
  function nearLayer(W, cx, g, h, half, rand) {
    const r = raster(W, h);
    college(r, cx, g, half, rand);
    for (let x = 0; x < W; x++) {
      const top = groundAt(x, cx, g, half) + 1;
      for (let y = top; y < h; y++) r.px(x, y, y === top ? C.lawnDk : Math.floor((y - g - 1) / 7) % 2 ? "#64a341" : C.lawnHi);
      // a paved path along the foot of the cloister
      if (x > cx + half) {
        const w = Math.round((x - cx) / half * 2);
        for (let y = top; y < top + w; y++) r.px(x, y, y === top + w - 1 ? "#a99a7c" : "#cdbd9c");
      }
    }
    const rx = clamp(Math.round(W * 0.15), 18, 32);
    const ry = Math.round(rx * 1.25);
    // soft shadows under the trees, then the paths over the grass
    for (const s of [-1, 1]) {
      const tx = cx + s * half;
      for (let y = g + 1; y < g + 7; y++) {
        const w = rx * 0.95 * Math.sqrt(Math.max(0, 1 - ((y - g - 3) / 3.5) ** 2));
        for (let x = Math.round(tx - w); x <= tx + w; x++) if (bayer(x, y) < 0.6) r.px(x + 1, y + 2, C.lawnLo);
      }
    }
    footpaths(r, cx, g, half);
    for (const s of [-1, 1]) {
      const tx = cx + s * half;
      blossoms(r, tx + 1, g + 5, rx, rand);
      bigJacaranda(r, tx, g + 3, rx, ry, rand);
      // a bench in the shade on the outer side of each trunk
      bench(r, s < 0 ? tx - 14 : tx + 5, g + 2);
    }
    return r.canvas();
  }

  /* ---------------------------- small trees ------------------------- */

  function jacaranda(r, x, base, size, rand, trunk = true, P = C) {
    const th = Math.round(size * 0.45);
    if (trunk) {
      r.rect(x, base - th, 2, th, P.trunk);
      r.px(x - 1, base - th + 2, P.trunk);
      r.px(x + 2, base - th + 3, P.trunk);
    }
    const cy = base - th - Math.round(size * 0.22);
    const R = size * 0.5;
    const blobs = [[0, 0, R], [-R * 0.7, R * 0.2, R * 0.7], [R * 0.7, R * 0.18, R * 0.72], [-R * 0.2, -R * 0.42, R * 0.66], [R * 0.3, -R * 0.38, R * 0.6]];
    const inside = (dx, dy) => blobs.some(([bx, by, br]) => (dx - bx) ** 2 + ((dy - by) * 1.15) ** 2 <= br * br);
    const span = Math.ceil(R * 1.8);
    for (let dy = -span; dy <= span; dy++) {
      for (let dx = -span; dx <= span; dx++) {
        if (!inside(dx, dy)) continue;
        const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
        const shade = (-dx / R) * 0.45 + (-dy / R) * 0.8 + (rand() - 0.5) * 0.7;
        const c = edge && shade < 0.3 ? P.jac3 : shade > 0.75 ? P.jacHi : shade > 0.15 ? P.jac1 : shade > -0.5 ? P.jac2 : P.jac3;
        r.px(x + 1 + dx, cy + dy, c);
      }
    }
  }

  function blossoms(r, x, base, size, rand) {
    for (let k = 0; k < size * 2; k++) {
      r.px(x + (rand() - 0.5) * size * 1.7, base + (rand() - 0.5) * 5, rand() < 0.5 ? C.jac1 : C.jac2);
    }
  }

  /* ------------------------ Sydney Uni, further back ----------------- */

  // Hazier sandstone, so it reads as further away than St Paul's.
  const U = {
    stoneHi: "#f6e5c3", stone: "#e7cda2", stoneMid: "#d7b98a", stoneLo: "#c2a074", stoneDk: "#9a7d5c",
    glass: "#5d77a0", glassHi: "#a9cbe8", roof: "#7c84a0", roofDk: "#646b88", roofHi: "#959cb6",
    lawn: "#7db65a", lawnLo: "#6ca34c", tree: "#4d8a45", treeHi: "#68a65a", treeDk: "#3a6f37", trunk: "#5a4636",
    jacHi: "#d3c6f4", jac1: "#b39fe6", jac2: "#9781d0", jac3: "#7b67b5",
  };

  function fig(r, x, base, size, rand, P) {
    const R = size / 2;
    r.rect(x, base - 3, 2, 3, P.trunk);
    for (let dy = -size; dy <= 0; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const d = Math.sqrt((dx / (R * 1.25)) ** 2 + ((dy + R + 2) / R) ** 2);
        if (d > 1 + (rand() - 0.5) * 0.18) continue;
        const shade = -dx / size - (dy + R) / size + (rand() - 0.5) * 0.5;
        r.px(x + dx, base - 2 + dy, shade > 0.45 ? P.treeHi : shade > -0.3 ? P.tree : P.treeDk);
      }
    }
  }

  // The Main Quadrangle's clock tower with its four corner turrets.
  function quadTower(r, tx, g) {
    ashlar(r, tx - 7, g - 60, 15, 60, g, U);
    r.rect(tx - 7, g - 60, 2, 60, U.stoneHi);
    r.rect(tx + 6, g - 60, 2, 60, U.stoneLo);
    arch(r, tx - 3, g - 13, 7, 13, U.stoneLo);
    arch(r, tx - 2, g - 12, 5, 12, U.stoneDk);
    lancet(r, tx - 2, g - 38, 5, 16, U);
    r.rect(tx, g - 36, 1, 14, U.stoneLo);
    disc(r, tx, g - 48, 3, U.stoneLo);
    disc(r, tx, g - 48, 2, "#fbf3e0");
    r.px(tx, g - 49, U.stoneDk);
    r.px(tx + 1, g - 48, U.stoneDk);
    lancet(r, tx - 4, g - 58, 2, 6, U);
    lancet(r, tx + 3, g - 58, 2, 6, U);
    r.rect(tx - 8, g - 61, 17, 1, U.stoneHi);
    for (let i = 0; i < 15; i++) if (i % 4 < 2) r.rect(tx - 7 + i, g - 64, 1, 3, U.stone);
    for (const px of [tx - 7, tx + 5]) {
      r.rect(px, g - 70, 3, 10, U.stone);
      r.rect(px, g - 70, 1, 10, U.stoneHi);
      r.rect(px + 2, g - 70, 1, 10, U.stoneLo);
      arch(r, px, g - 74, 3, 4, U.stoneMid);
      r.px(px + 1, g - 75, U.stoneDk);
    }
    r.rect(tx, g - 80, 1, 16, U.stoneDk);
    r.rect(tx + 1, g - 80, 5, 3, "#2d55a8");
    r.px(tx + 2, g - 79, "#ffffff");
  }

  // The Great Hall: a steep gable with a huge window and a little flèche.
  function greatHall(r, hx, g) {
    ashlar(r, hx - 10, g - 30, 21, 30, g, U);
    for (let j = 0; j < 22; j++) {
      const half = Math.round(10 * (1 - j / 22));
      if (half <= 0) break;
      for (let i = -half; i <= half; i++) {
        if (Math.abs(i) >= half - 1) r.px(hx + i, g - 31 - j, i < 0 ? U.stoneHi : U.stoneMid);
        else stonePx(r, hx + i, g - 31 - j, g, U);
      }
    }
    r.rect(hx, g - 60, 1, 8, U.roofDk);
    r.px(hx, g - 61, U.stoneDk);
    r.rect(hx - 10, g - 30, 2, 30, U.stoneHi);
    r.rect(hx + 9, g - 30, 2, 30, U.stoneLo);
    arch(r, hx - 5, g - 34, 11, 24, U.stoneLo);
    arch(r, hx - 4, g - 33, 9, 23, U.glass);
    for (const mx of [hx - 2, hx, hx + 2]) r.rect(mx, g - 26, 1, 16, U.stoneLo);
    r.rect(hx - 4, g - 20, 9, 1, U.stoneLo);
    r.px(hx - 3, g - 30, U.glassHi);
    r.px(hx + 1, g - 24, U.glassHi);
    r.rect(hx - 5, g - 10, 11, 1, U.stoneHi);
    arch(r, hx - 2, g - 8, 5, 8, U.stoneDk);
  }

  // The mid layer: Sydney Uni over the college roofs, Victoria Park's trees below.
  function midLayer(W, cx, g, h, rand) {
    const r = raster(W, h);
    for (let y = g; y < h; y++) {
      for (let x = 0; x < W; x++) {
        if (y < g + 4) r.px(x, y, (y - g) % 2 ? U.lawn : U.lawnLo);
        else {
          const n = bayer(x, y) + Math.sin(x * 0.7 + y * 0.31) * 0.3 + Math.sin(x * 0.23 - y * 0.6) * 0.3;
          r.px(x, y, n > 0.85 ? U.treeHi : n > 0.2 ? U.tree : U.treeDk);
        }
      }
    }

    const tx = cx + 40;
    const hx = cx - 54;
    const q0 = hx + 11;
    const q1 = Math.min(W + 4, cx + 120);

    // the long Quad range: slate roof, battlemented parapet, two storeys of lancets
    for (let j = 0; j < 6; j++) {
      for (let x = q0 + j; x < q1; x++) r.px(x, g - 31 - j, j === 5 ? U.roofHi : (x + j) % 4 === 0 ? U.roofDk : U.roof);
    }
    ashlar(r, q0, g - 30, q1 - q0, 30, g, U);
    r.rect(q0, g - 31, q1 - q0, 1, U.stoneHi);
    for (let x = q0; x < q1; x++) if ((x - q0) % 4 < 2) r.rect(x, g - 33, 1, 2, U.stone);
    r.rect(q0, g - 15, q1 - q0, 1, U.stoneHi);
    r.rect(q0, g - 2, q1 - q0, 2, U.stoneLo);
    for (let x = q0 + 4; x < q1 - 2; x += 7) {
      if (Math.abs(x + 1 - tx) < 11) continue;
      lancet(r, x, g - 26, 3, 9, U);
      lancet(r, x, g - 12, 3, 9, U);
      r.rect(x + 5, g - 30, 1, 30, U.stoneHi);
    }
    // a lower range off the far side of the Great Hall
    const l1 = hx - 11;
    for (let x = Math.max(0, l1 - 70); x < l1; x++) {
      for (let y = g - 18; y < g; y++) stonePx(r, x, y, g, U);
      r.px(x, g - 19, U.stoneHi);
      if ((l1 - x) % 3 < 2) r.px(x, g - 20, U.stone);
      if ((l1 - x) % 6 === 3) arch(r, x - 1, g - 14, 3, 7, U.glass);
    }

    greatHall(r, hx, g);
    quadTower(r, tx, g);

    // the famous Quad jacaranda, and figs along Victoria Park
    jacaranda(r, tx + 19, g + 3, 24, rand, true, U);
    for (let x = 4; x < W; x += 9 + Math.round(rand() * 8)) {
      if (x > hx - 14 && x < q1 - 4 && Math.abs(x - (tx + 19)) > 12 && rand() < 0.6) continue;
      fig(r, x, g + 6 + Math.round(rand() * 3), 8 + Math.round(rand() * 5), rand, U);
    }
    return r.canvas();
  }

  /* ----------------------- the city on the horizon ------------------- */

  const F = {
    tower: "#9fb9d4", towerHi: "#bcd1e6", towerLo: "#86a2c0", win: "#7f9bb9",
    steel: "#7d96b2", steelHi: "#9cb3cb", pylon: "#d8cdb5", pylonLo: "#bfb39b",
    sail: "#f6f9fc", sailLo: "#cfdbe6", turret: "#e7c77a", turretLo: "#c9a65a",
    water: "#78aed6", waterHi: "#c9e6fa", hill: "#b3c8d8",
    sub: "#a7c0b0", subLo: "#98b3a3", roof: "#c9a99a", roofLo: "#b8968a",
  };

  function farLayer(W, h, fh, rand) {
    const r = raster(W, h);

    // distant ridge, harbour, then suburbs rolling towards us
    for (let x = 0; x < W; x++) {
      const ridge = Math.round(4 + Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13 + 1) * 1.5);
      for (let y = fh - 4 - ridge; y < fh - 4; y++) r.px(x, y, F.hill);
      for (let y = fh - 4; y < fh; y++) r.px(x, y, (x + y * 3) % 11 === 0 ? F.waterHi : F.water);
      for (let y = fh; y < h; y++) {
        const roof = (x * 7 + Math.floor((y - fh) / 2) * 13) % 9 === 0 && (y - fh) % 2 === 0;
        r.px(x, y, roof ? (bayer(x, y) < 0.5 ? F.roof : F.roofLo) : bayer(x, y) < 0.45 ? F.subLo : F.sub);
      }
    }

    // the Harbour Bridge
    const span = clamp(Math.round(W * 0.36), 40, 80);
    const bx = Math.round(W * 0.24);
    const deck = fh - 9;
    const archH = Math.round(span * 0.3);
    const archY = (x) => fh - 3 - archH * (1 - ((2 * (x - bx)) / span) ** 2);
    for (let x = bx - span / 2; x <= bx + span / 2; x++) {
      const y = Math.round(archY(x));
      r.px(x, y, F.steelHi);
      r.px(x, y + 1, F.steel);
      r.px(x, y + 3, F.steel);
      if (Math.round(x) % 3 === 0) {
        if (y + 3 < deck) r.rect(x, y + 2, 1, deck - y - 2, F.steel);
        else r.rect(x, deck, 1, y + 3 - deck, F.steel);
      } else r.px(x, y + 2, F.steel);
    }
    r.rect(bx - span / 2 - 14, deck, span + 28, 1, F.steelHi);
    r.rect(bx - span / 2 - 14, deck + 1, span + 28, 1, F.steel);
    for (const px of [bx - span / 2 - 4, bx + span / 2]) {
      r.rect(px, deck - 7, 4, fh - deck + 7, F.pylon);
      r.rect(px + 3, deck - 7, 1, fh - deck + 7, F.pylonLo);
      r.rect(px + 1, deck - 4, 2, 2, F.pylonLo);
    }

    // the Opera House sails at the south end
    const ox = bx + span / 2 + 8;
    r.rect(ox - 1, fh - 2, 17, 2, F.pylon);
    for (const [sx, sw, sh] of [[ox, 6, 6], [ox + 5, 6, 8], [ox + 10, 5, 5]]) {
      for (let j = 0; j < sh; j++) {
        const w = Math.max(1, Math.round(sw * (1 - j / sh)));
        r.rect(sx, fh - 3 - j, w, 1, F.sail);
        r.px(sx + w - 1, fh - 3 - j, F.sailLo);
      }
    }

    // the CBD, tallest in the middle, with Sydney Tower's golden turret
    const c0 = ox + 20;
    const c1 = Math.min(W - 2, c0 + clamp(Math.round(W * 0.48), 44, 150));
    const st = Math.round(c0 + (c1 - c0) * 0.55);
    for (let x = c0; x < c1;) {
      const w = 4 + Math.floor(rand() * 5);
      const mid = 1 - Math.abs((x - c0) / (c1 - c0) - 0.5) * 1.4;
      const th = Math.round(8 + mid * 22 + rand() * 9);
      for (let j = 0; j < th; j++) {
        for (let i = 0; i < w; i++) {
          const win = i % 2 === 1 && j % 3 === 1 && i < w - 1;
          r.px(x + i, fh - 1 - j, i === 0 ? F.towerHi : i === w - 1 ? F.towerLo : win ? F.win : F.tower);
        }
      }
      if (rand() < 0.3) r.rect(x + (w >> 1), fh - 1 - th - 3, 1, 3, F.towerLo);
      x += w + (rand() < 0.3 ? 1 : 0);
    }
    r.rect(st, fh - 36, 2, 36, F.towerHi);
    r.rect(st + 1, fh - 36, 1, 36, F.towerLo);
    r.rect(st - 2, fh - 41, 6, 5, F.turret);
    r.rect(st - 2, fh - 38, 6, 1, F.turretLo);
    r.rect(st - 1, fh - 42, 4, 1, F.turretLo);
    r.rect(st, fh - 50, 1, 8, F.towerLo);
    return r.canvas();
  }

  /* ------------------------------- sky ------------------------------ */

  // Sky colour by altitude in metres: a light blue day, then golden hour,
  // sunset, twilight and deep night towards the top.
  const SKY = [
    [-80, "#e4f6ff"], [0, "#cfeeff"], [60, "#b2e2ff"], [140, "#93d2fb"], [215, "#7ec2f4"],
    [248, "#a9c9e8"], [270, "#ffe3a3"], [290, "#ffbe72"], [308, "#ff9466"], [326, "#ef6f78"],
    [344, "#c25288"], [364, "#7f4596"], [388, "#4a3888"], [418, "#272a68"], [452, "#151948"],
    [490, "#0d0c2e"], [600, "#140a2c"],
  ];

  function skyStops(p) {
    let i = 0;
    while (i < SKY.length - 2 && p >= SKY[i + 1][0]) i++;
    const [p0, c0] = SKY[i];
    const [p1, c1] = SKY[i + 1];
    return [c0, c1, clamp((p - p0) / (p1 - p0), 0, 1)];
  }

  function skyAt(p, x, y) {
    const [c0, c1, t] = skyStops(p);
    return bayer(x, y) < t ? c1 : c0;
  }

  const skyFlat = (p) => {
    const [c0, c1, t] = skyStops(p);
    return mixHex(c0, c1, t);
  };

  function cloudPal(p) {
    if (p < 250) return ["#ffffff", "#eef6ff", "#c9dcf0"];
    if (p < 300) return ["#fff3d9", "#ffd3a6", "#f0a27e"];
    if (p < 345) return ["#ffd0b8", "#f59a92", "#c9668a"];
    return ["#b691c9", "#8a6aa8", "#5f4a86"];
  }

  function cloudSprite(w, h, pal, rand, flat) {
    const r = raster(w, h);
    const n = Math.max(2, Math.round(w / (flat ? 14 : 10)));
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0.5;
      const br = h * (flat ? 0.45 : 0.32 + rand() * 0.3) * (1 - Math.abs(u - 0.5) * 0.7);
      blobs.push([w * (0.14 + 0.72 * u) + (rand() - 0.5) * 4, h - br - 1, br]);
    }
    const base = flat ? 0.45 : 0.62;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inBlob = blobs.some(([bx, by, br]) => (x - bx) ** 2 + ((y - by) * 1.1) ** 2 <= br * br);
        const inBase = y >= h * base && y < h - 1 && x > w * 0.08 && x < w * 0.92;
        if (!inBlob && !inBase) continue;
        const v = y / h + (bayer(x, y) - 0.5) * 0.25;
        r.px(x, y, v < 0.42 ? pal[0] : v < 0.74 ? pal[1] : pal[2]);
      }
    }
    return r.canvas();
  }

  function makeClouds(W, rand) {
    const out = [];
    const add = (count, p0, p1, w0, w1, flat) => {
      for (let i = 0; i < count; i++) {
        const p = p0 + rand() * (p1 - p0);
        const w = Math.round(w0 + rand() * (w1 - w0));
        const h = flat ? 4 + Math.round(rand() * 4) : Math.max(7, Math.round(w * (0.36 + rand() * 0.12)));
        out.push({ p, x: rand() * (W + w) - w, v: 0.02 + rand() * 0.06, cv: cloudSprite(w, h, cloudPal(p), rand, flat) });
      }
    };
    add(3 + Math.round(W / 120), 30, 125, 18, 34, false);
    add(8 + Math.round(W / 14), 150, 262, 24, 66, false);
    add(4 + Math.round(W / 24), 268, 346, 30, 72, true);
    add(2 + Math.round(W / 90), 350, 386, 38, 62, true);
    return out;
  }

  // Bright stars: [dx, dy, colour, size]. The Southern Cross and its pointers.
  const CRUX = [
    [0, -11, "#ffd9b0", 2], [1, 10, "#ffffff", 2], [-7, -1, "#e6ecff", 2], [6, -3, "#ffffff", 1], [3, 4, "#c7ccf5", 0],
    [-24, 12, "#fff4dc", 2], [-16, 9, "#e6ecff", 1],
  ];

  function brightStar(r, x, y, c, size) {
    r.px(x, y, c);
    if (size < 1) return;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.px(x + dx, y + dy, size > 1 ? "#c7ccf5" : "#6f78b8");
    if (size > 1) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) r.px(x + dx, y + dy, "#5c64a6");
  }

  /* ---------------------------- Jerusalem --------------------------- */

  const J = {
    body: "#f3cf73", hi: "#ffe9a8", lo: "#cf9e45", dk: "#a8762e", cap: "#ffe48a", capLo: "#e9b84a",
    win: "#fff6c8", pearl: "#fff8e8", ray: "#f7d98c",
  };
  const JEWELS = ["#d2423c", "#2e6fd6", "#7fb4c9", "#2fae6a", "#c8643c", "#b0263a", "#d6d34c", "#58c7b8", "#f0b03c", "#7cc46a", "#e0703a", "#9a5ad0"];

  function jerusalem(r, cx, rb, rand, rowP) {
    const W = r.w;
    const glowY = rb - 26;
    // a warm glow, then rays fanning up from the city
    for (let y = glowY - 80; y < rb + 24; y++) {
      const sky = skyFlat(rowP(y));
      for (let x = cx - 80; x < cx + 80; x++) {
        const d = Math.hypot(x - cx, (y - glowY) * 1.15);
        if (d > 78 || !r.has(x, y)) continue;
        const t = (1 - d / 78) ** 1.4;
        const lvl = Math.floor(t * 4 + bayer(x, y)) / 4;
        if (lvl > 0) r.px(x, y, mixHex(sky, "#c98a58", lvl * 0.5));
      }
    }
    for (let a = -75; a <= 75; a += 15) {
      const rad = (a * Math.PI) / 180;
      const len = 70 + (Math.abs(a) % 30) * 0.8;
      for (let l = 18; l < len; l++) {
        const x = Math.round(cx + Math.sin(rad) * l);
        const y = Math.round(glowY - Math.cos(rad) * l);
        if (bayer(x, y) < 0.55 * (1 - l / len)) r.px(x, y, J.ray);
      }
    }

    const cw = Math.min(86, W - 8);
    const wl = cx - (cw >> 1);
    const wallTop = rb - 16;

    // towers behind the wall: [offset, width, height, cap]
    const towers = [[0, 11, 46, "spire"], [-16, 8, 33, "dome"], [16, 8, 33, "dome"], [-29, 7, 25, "spire"], [29, 7, 25, "spire"], [-38, 5, 19, "cone"], [38, 5, 19, "cone"]];
    for (const [off, w, h, cap] of towers) {
      const x0 = cx + off - (w >> 1);
      if (x0 < wl - 2 || x0 + w > wl + cw + 2) continue;
      const top = wallTop - h;
      for (let y = top; y < wallTop; y++) {
        for (let i = 0; i < w; i++) r.px(x0 + i, y, i === 0 ? J.hi : i === w - 1 ? J.lo : (wallTop - y) % 4 === 0 && bayer(x0 + i, y) < 0.5 ? J.lo : J.body);
      }
      for (let wy = top + 5; wy < wallTop - 3; wy += 7) arch(r, x0 + (w >> 1) - 1, wy, w > 6 ? 3 : 1, 4, J.win);
      for (let i = 0; i < w; i += 2) r.px(x0 + i, top - 1, J.body);
      const mx = x0 + (w >> 1);
      if (cap === "dome") {
        for (let j = 0; j < 5; j++) {
          const half = Math.round(Math.sqrt(Math.max(0, 25 - (5 - j) ** 2)) * (w / 10));
          r.rect(mx - half, top - 2 - (5 - j), half * 2 + 1, 1, j < 2 ? J.cap : J.capLo);
        }
        r.rect(mx, top - 9, 1, 3, J.dk);
        r.rect(mx + 1, top - 9, 3, 2, C.maroon);
        r.px(mx + 2, top - 9, C.gold);
      } else {
        const sh = cap === "spire" ? Math.round(w * 1.8) : Math.round(w * 1.1);
        for (let j = 0; j < sh; j++) {
          const half = Math.round(((w + 1) / 2) * (j / sh));
          r.rect(mx - half, top - 1 - sh + j, half * 2 + 1, 1, j < sh / 2 ? J.cap : J.capLo);
        }
        if (off === 0) {
          // the central spire carries a Maltese cross
          const ty = top - sh - 7;
          for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [-1, 2], [1, 2], [-2, 1], [-2, 3], [2, 1], [2, 3], [-1, 0], [1, 0], [-1, 4], [1, 4]]) r.px(mx + dx, ty + dy, J.pearl);
          r.px(mx, ty + 2, J.cap);
        }
      }
    }

    // the wall with battlements, three pearly gates and twelve jewelled foundations
    for (let y = wallTop; y < rb; y++) {
      for (let x = wl; x < wl + cw; x++) {
        const course = (rb - y) % 4 === 0 || (x + (((rb - y) >> 2) & 1) * 3) % 8 === 0;
        r.px(x, y, x === wl ? J.hi : x === wl + cw - 1 ? J.lo : course && bayer(x, y) < 0.5 ? J.lo : J.body);
      }
    }
    for (let x = wl; x < wl + cw; x++) {
      r.px(x, wallTop, J.hi);
      if ((x - wl) % 4 < 2) r.rect(x, wallTop - 3, 1, 3, J.body);
    }
    for (const gx of [cx, cx - Math.round(cw * 0.3), cx + Math.round(cw * 0.3)]) {
      arch(r, gx - 4, rb - 12, 9, 12, J.dk);
      arch(r, gx - 3, rb - 11, 7, 11, J.pearl);
      r.rect(gx - 1, rb - 7, 3, 7, "#fffdf6");
    }
    for (let x = wl; x < wl + cw; x++) {
      const c = JEWELS[Math.floor((x - wl) / 2) % 12];
      r.px(x, rb, c);
      r.px(x, rb + 1, mixHex(c, "#000000", 0.25));
    }

    // a golden cloud to stand on
    const cloud = cloudSprite(cw + 24, 12, ["#fff1c9", "#f6cf7a", "#d99a56"], rand, true);
    const cctx = cloud.getContext("2d");
    const data = cctx.getImageData(0, 0, cloud.width, cloud.height).data;
    for (let y = 0; y < cloud.height; y++) {
      for (let x = 0; x < cloud.width; x++) {
        const i = (y * cloud.width + x) * 4;
        if (data[i + 3]) r.px(wl - 12 + x, rb + 1 + y, "#" + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join(""));
      }
    }
  }

  /* ---------------------------- the sky column ---------------------- */

  // One tall canvas, bottom row = the ground view. rowP(row) gives the altitude at a row.
  function skyLayer(W, SH, rowP, cx, cityRow, rand) {
    const r = raster(W, SH);
    const twinkles = [];
    for (let y = 0; y < SH; y++) {
      const p = rowP(y);
      const starP = clamp((p - 335) / 130, 0, 1) ** 1.3;
      const mw = p > 395 ? W * 0.1 + (p - 395) * K * 0.32 : null;
      const mwC = mw === null ? null : mixHex(skyFlat(p), "#9aa0e0", 0.22);
      for (let x = 0; x < W; x++) {
        r.px(x, y, skyAt(p, x, y));
        if (mw !== null) {
          const dx = Math.abs(x - mw - Math.sin(y * 0.05) * 6);
          const half = 13 + Math.sin(y * 0.021) * 4;
          if (dx < half && bayer(x, y) < (1 - dx / half) * 0.5) r.px(x, y, mwC);
          if (dx < half && rand() < 0.03) r.px(x, y, "#8f97c9");
        }
        if (starP && rand() < starP * 0.016) {
          const k = rand();
          r.px(x, y, k < 0.6 ? "#7f86c0" : k < 0.9 ? "#c7ccf5" : "#ffffff");
          if (k > 0.82) twinkles.push([x, y, Math.floor(rand() * 64)]);
        }
      }
    }
    const crossRow = Math.round(cityRow + 150 + (W > 200 ? 0 : 20));
    const crossX = Math.round(W * 0.74);
    for (const [dx, dy, c, s] of CRUX) brightStar(r, crossX + dx, crossRow + dy, c, s);
    jerusalem(r, cx, cityRow, rand, rowP);
    return { canvas: r.canvas(), twinkles };
  }

  /* ----------------------------- sprites ---------------------------- */

  // Paint a little picture onto a grid, then outline it. set(x, y, c, true) skips the outline there.
  function paint(w, h, draw, outline = C.ink) {
    const g = Array.from({ length: h }, () => Array(w).fill(null));
    const bare = new Set();
    const set = (x, y, c, noLine) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      g[y][x] = c;
      if (noLine) bare.add(y * w + x);
    };
    draw(set);
    if (outline) {
      const add = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (g[y][x]) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const yy = y + dy;
            const xx = x + dx;
            return yy >= 0 && xx >= 0 && yy < h && xx < w && g[yy][xx] && !bare.has(yy * w + xx);
          });
          if (near) add.push([x, y]);
        }
      }
      for (const [x, y] of add) g[y][x] = outline;
    }
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d");
    g.forEach((row, y) => row.forEach((col, x) => {
      if (!col) return;
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
    }));
    return cv;
  }

  const GOLD3 = (s) => (s > 1.2 ? "#fff0b0" : s > -1 ? C.gold : C.goldDk);

  const ICONS = {
    // 🍷 the obvious answer: everyone's had one at Formal
    wine: (set) => {
      [[4, 11], [4, 11], [4, 11], [4, 11], [5, 10], [5, 10], [6, 9]].forEach(([a, b], j) => {
        const y = 2 + j;
        for (let x = a; x <= b; x++) {
          if (y < 4) set(x, y, x === 5 ? "#ffffff" : "#d9ecf7");
          else if (y === 4) set(x, y, "#e0456a");
          else set(x, y, x === a ? "#d02c55" : x === b ? "#6b0b27" : "#b0173f");
        }
      });
      for (let y = 9; y <= 11; y++) { set(7, y, "#d9ecf7"); set(8, y, "#a9c4d8"); }
      for (let x = 5; x <= 10; x++) set(x, 12, x < 8 ? "#d9ecf7" : "#a9c4d8");
    },
    // 💍
    rings: (set) => {
      const on = (x, y, cx, cy) => { const d = Math.hypot(x - cx, y - cy); return d >= 2.5 && d <= 4.4; };
      const shade = (x, y, cx, cy) => GOLD3(-(x - cx) * 0.6 - (y - cy) * 0.8);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (on(x, y, 10, 9.5)) set(x, y, shade(x, y, 10, 9.5));
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (on(x, y, 5.5, 9.5) && !(on(x, y, 10, 9.5) && y > 9.5)) set(x, y, shade(x, y, 5.5, 9.5));
      }
      for (const [x, y, c] of [[10, 2, "#ffffff"], [9, 3, "#bfefff"], [10, 3, "#ffffff"], [11, 3, "#7fd0f0"], [10, 4, "#4fa8d8"]]) set(x, y, c);
    },
    // 🎹 the common-room upright
    piano: (set) => {
      const wood = "#3a2436";
      for (let x = 2; x <= 13; x++) { set(x, 2, "#6a4b63"); set(x, 3, wood); }
      for (let y = 4; y <= 7; y++) for (let x = 2; x <= 13; x++) set(x, y, wood);
      for (let x = 6; x <= 9; x++) { set(x, 5, "#f4efe2"); set(x, 6, "#d9cfb8"); }
      set(4, 5, C.gold); set(11, 5, C.gold);
      for (let x = 1; x <= 14; x++) set(x, 8, "#24161f");
      for (let x = 2; x <= 13; x++) { set(x, 9, [3, 5, 8, 10, 12].includes(x) ? "#15121c" : "#f4f0e6"); set(x, 10, "#f4f0e6"); }
      for (let x = 2; x <= 13; x++) set(x, 11, "#24161f");
      for (let x = 3; x <= 12; x++) set(x, 12, wood);
      set(3, 13, wood); set(12, 13, wood); set(7, 13, C.gold); set(8, 13, C.gold);
    },
    // 🏆 the chapel chalice
    chalice: (set) => {
      [[3, 12], [3, 12], [4, 11], [4, 11], [5, 10], [6, 9], [7, 8], [6, 9], [7, 8], [5, 10], [4, 11]].forEach(([a, b], j) => {
        const y = 2 + j;
        for (let x = a; x <= b; x++) set(x, y, j === 0 ? "#fff0b0" : GOLD3((7.5 - x) * 0.7 + (j === 10 ? 0.5 : 0)));
      });
      set(7, 4, "#e8506e"); set(8, 4, "#c8203f"); set(7, 5, "#c8203f"); set(8, 5, "#8a0f2a");
    },
    // ⚔️ two swords in saltire
    swords: (set) => {
      for (const m of [false, true]) {
        const X = (x) => (m ? 15 - x : x);
        for (let i = 1; i <= 9; i++) { set(X(i), i, "#f4f8ff"); set(X(i + 1), i, "#aeb9cc"); }
        for (let k = -2; k <= 2; k++) set(X(10 + k), 10 - k, Math.abs(k) === 2 ? C.goldDk : C.gold);
        set(X(11), 11, C.maroon); set(X(12), 12, C.maroon);
        set(X(13), 13, C.gold);
      }
    },
    // ✠ the Maltese cross
    cross: (set) => {
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const f = (d) => Math.floor(0.6 + d * 0.42);
        const ady = Math.abs(dy);
        const adx = Math.abs(dx);
        const inV = ady >= 1 && adx <= f(ady) && !(ady === 6 && adx <= 1) && !(ady === 5 && adx === 0);
        const inH = adx >= 1 && ady <= f(adx) && !(adx === 6 && ady <= 1) && !(adx === 5 && ady === 0);
        if (!(inV || inH || (adx === 0 && ady === 0))) continue;
        const s = dx + dy;
        set(7 + dx, 7 + dy, s < -3 ? "#fff0b0" : s > 2 ? C.goldDk : C.gold);
      }
      set(7, 7, C.maroon);
    },
    // ❌ grounded: a little rain cloud
    miss: (set) => {
      const blobs = [[5, 7, 3], [9, 5.5, 3.5], [12, 7.5, 2.5]];
      for (let y = 2; y <= 9; y++) for (let x = 1; x <= 14; x++) {
        const inside = blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br) || (y >= 7 && x >= 3 && x <= 13);
        if (inside) set(x, y, y < 5 ? "#d5dbe6" : y < 8 ? "#a3acbe" : "#7a8399");
      }
      for (const [x, y] of [[4, 11], [4, 12], [8, 12], [8, 13], [12, 11], [12, 12]]) set(x, y, "#5fb4f0");
    },
    // 🎈 a tiny balloon for the altitude readout
    balloon: (set) => {
      [2, 3, 4, 4, 4, 4, 3, 3, 2, 1].forEach((w, j) => {
        for (let dx = -w; dx <= w; dx++) {
          const gold = Math.floor(((dx / (w + 0.5)) + 1) * 1.5) === 1;
          set(7 + dx, 1 + j, gold ? C.gold : dx > w / 2 ? C.maroonDk : C.maroon);
        }
      });
      set(5, 2, "#ffffff", true);
      set(6, 11, "#6e4824", true); set(8, 11, "#6e4824", true);
      for (let x = 5; x <= 9; x++) { set(x, 12, "#c48a4f"); set(x, 13, "#9a6a3a"); }
    },
  };

  const iconCanvas = new Map();
  function icon(name) {
    if (!iconCanvas.has(name)) iconCanvas.set(name, paint(16, 16, ICONS[name]));
    return iconCanvas.get(name);
  }

  // The hot-air balloon you ride, in college colours. Two frames: burner off and on.
  function balloonSprite(flame) {
    return paint(19, 32, (set) => {
      const cx = 9;
      [3, 5, 6, 7, 7, 8, 8, 8, 8, 8, 8, 7, 7, 6, 6, 5, 5, 4, 3, 3, 2].forEach((w, j) => {
        const y = j + 1;
        for (let dx = -w; dx <= w; dx++) {
          const u = dx / (w + 0.5);
          const gold = Math.floor((u + 1) * 2.5) % 2 === 1;
          let c = gold ? C.gold : C.maroon;
          if (u > 0.5) c = gold ? C.goldDk : C.maroonDk;
          else if (u < -0.55 && j < 14) c = gold ? C.goldHi : "#b02a4c";
          if (j === 16) c = C.maroonDk;
          set(cx + dx, y, c);
        }
      });
      set(cx - 4, 4, "#ffffff", true);
      set(cx - 5, 6, "#f6d0d8", true);
      for (const s of [-1, 1]) {
        for (const [dx, y] of [[2, 22], [2, 23], [3, 24], [3, 25]]) set(cx + s * dx, y, "#6e4824", true);
      }
      set(cx, 24, "#4b4f63", true);
      if (flame) {
        set(cx, 22, "#ffe48a", true);
        set(cx - 1, 23, "#ff9a3c", true);
        set(cx, 23, "#ffffff", true);
        set(cx + 1, 23, "#ff9a3c", true);
      }
      set(cx - 1, 25, "#f1c9a0", true);
      set(cx - 1, 24, "#5a3a20", true);
      for (let x = cx - 3; x <= cx + 3; x++) {
        set(x, 26, "#c48a4f");
        for (let y = 27; y <= 29; y++) set(x, y, (x + y) % 2 ? "#9a6a3a" : "#7d5530");
      }
    });
  }

  const BIRD = [["ww...ww", "..wyw..", "......."], [".......", "..wyw..", "ww...ww"]];
  const BAT = [["k.....k", ".kk.kk.", "...k..."], ["...k...", ".kkkkk.", "k.....k"]];
  const IBIS = [
    ["..KK.....", ".K..K....", "K...KW...", "....WWWW.", ".....WWWK", ".....K.K.", ".....K.K."],
    ["..KK.....", ".K..K....", "K...KW...", "....WWWW.", ".....WWWK", "......K..", ".....K.K."],
  ];

  /* --------------------------- the live world ------------------------ */

  const TIER_ICON = { 0: "miss", 1: "wine", 2: "rings", 3: "piano", 4: "chalice", 5: "swords" };
  // Where the balloon sits on screen, as a share of the height. Ground = parked on the lawn.
  const ANCHOR = { play: 0.8, summit: 0.72 };

  let canvas = null;
  let ctx = null;
  let probe = null;
  let S = null;          // the built world
  let view = "ground";
  let alt = 0;           // the balloon's altitude in metres, as drawn
  let anchor = null;     // the balloon's screen row, as drawn
  let anim = null;
  let anchorAnim = null;
  let trail = [];
  let effects = [];
  let frame = 0;
  let lastTick = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function anchorFor(v) {
    return v === "ground" || !S ? (S ? S.rest : 0) : Math.round(S.H * ANCHOR[v]);
  }

  function camera() {
    return clamp(Math.round(alt * K - (S.rest - anchor)), 0, S.camMax);
  }

  function moonSprite() {
    const r = raster(27, 27);
    for (let y = 0; y < 27; y++) {
      for (let x = 0; x < 27; x++) {
        const d = Math.hypot(x - 13, y - 13);
        if (d <= 8.4) {
          const crater = [[10, 10, 2.2], [16, 15, 2.8], [12, 17, 1.5], [17, 9, 1.4]].some(([a, b, rr]) => Math.hypot(x - a, y - b) <= rr);
          r.px(x, y, crater ? "#d9cfa8" : x + y > 30 ? "#e6dcb6" : "#f7f0d4");
        } else if (d <= 13 && bayer(x, y) < (13 - d) / 10) r.px(x, y, "#4a4f8a");
      }
    }
    return r.canvas();
  }

  function build() {
    // Some in-app browsers (Facebook's on Android) report a zero-size window for a moment
    // while they open. Draw at phone size until the resize with the real size arrives.
    const vw = document.documentElement.clientWidth || window.innerWidth || 375;
    const vh = Math.max(probe.offsetHeight || 0, window.innerHeight) || 667;
    const scale = clamp(Math.round(Math.min(vw / 130, vh / 230)), 2, 6);
    const W = Math.ceil(vw / scale);
    const H = Math.ceil(vh / scale);
    const cx = Math.floor(W / 2);
    const Gy0 = Math.round(H * 0.62);
    const rest = Gy0 + 14;
    const camMax = TOP * K - (rest - Math.round(H * ANCHOR.summit));
    const SH = H + camMax;
    const base = camMax + rest;
    const cityRow = base - TOP * K - 40;
    const rand = rng(1854);

    const nearG = 120;
    const half = clamp(Math.round(W / 3.6), 30, 110);
    const midG = 84;
    const farH = 52;
    const sky = skyLayer(W, SH, (row) => (base - row) / K, cx, cityRow, rand);
    const sparkles = Array.from({ length: 14 }, () => [cx + Math.round((rand() - 0.5) * 110), cityRow - 10 - Math.round(rand() * 70), Math.floor(rand() * 40)]);

    S = {
      W, H, cx, Gy0, rest, camMax, base, cityRow, scale,
      sky: sky.canvas, twinkles: sky.twinkles, sparkles,
      near: nearLayer(W, cx, nearG, nearG + (H - Gy0), half, rand), nearG,
      mid: midLayer(W, cx, midG, midG + H, rand), midG,
      far: farLayer(W, farH + H, farH, rand), farH,
      clouds: makeClouds(W, rand),
      moon: moonSprite(),
      balloon: [balloonSprite(false), balloonSprite(true)],
      bx: cx + clamp(Math.round(W * 0.22), 22, 40) - 9,
      ibis: { x: cx - 40, dir: 1, rest: 0 },
      flocks: [
        { p: 72, x: W * 0.2, v: -0.35, n: 5, art: BIRD, c: { w: "#ffffff", y: "#ffd84a" } },
        { p: 104, x: W * 0.7, v: 0.28, n: 3, art: BIRD, c: { w: "#ffffff", y: "#ffd84a" } },
        { p: 316, x: W * 0.1, v: 0.22, n: 7, art: BAT, c: { k: "#2a1830" } },
        { p: 333, x: W * 0.6, v: 0.3, n: 4, art: BAT, c: { k: "#2a1830" } },
      ],
      plane: { p: 232, x: -40 },
      meteor: null,
    };

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W * scale + "px";
    canvas.style.height = H * scale + "px";
    const root = document.documentElement.style;
    root.setProperty("--title-h", Math.max(60, (Gy0 - 88) * scale) + "px");
    root.setProperty("--lawn-y", (rest + 3) * scale + "px");
    anchor = anchorFor(view);
    anchorAnim = null;
    draw();
  }

  /* ----------------------------- drawing ---------------------------- */

  const yAt = (p, c) => S.rest + c - Math.round(p * K);

  function pixels(rows, pal, x0, y0, flip) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = pal[row[i]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(flip ? x0 + row.length - 1 - i : x0 + i, y0 + j, 1, 1);
      }
    });
  }

  // The sun crosses the sky as you climb: high and white at first, big and red by sunset.
  function sun() {
    const { W, H } = S;
    const t = clamp(alt / 300, 0, 1);
    const R = Math.round(lerp(6, 13, t));
    const x0 = Math.round(lerp(W * 0.88, W * 0.68, t));
    const y0 = Math.round(lerp(H * 0.3, H * 0.74, t * t) + Math.max(0, alt - 300) * K * 0.9);
    if (y0 - R - 4 > H) return;
    const core = mixHex("#fff6c4", "#ff7a48", clamp((alt - 170) / 140, 0, 1));
    const halo = mixHex("#fffbe0", "#ffc06a", t);
    for (let dy = -R - 4; dy <= R + 4; dy++) {
      for (let dx = -R - 4; dx <= R + 4; dx++) {
        const d = Math.hypot(dx, dy);
        const x = x0 + dx;
        const y = y0 + dy;
        if (d <= R) {
          if (t > 0.72 && dy > R * 0.15 && (dy + 1) % 3 === 0) continue;
          ctx.fillStyle = core;
        } else if (d <= R + 4 && bayer(x, y) < (R + 4 - d) / 9) ctx.fillStyle = halo;
        else continue;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function moon() {
    const m = clamp((alt - 330) / 110, 0, 1);
    if (!m) return;
    const y = Math.round(lerp(S.H * 1.1, S.H * 0.16, 1 - (1 - m) ** 2));
    ctx.drawImage(S.moon, Math.round(S.W * 0.24) - 13, y - 13);
  }

  // Students sitting in a circle on the lawn: [dx, dy, shirt, skin, legs].
  const STUDENTS = [
    [-8, 1, "#ffffff", "#e9b48a", "#e9b48a"], [-5, -1, "#7a1630", "#c68a5e", "#3a4a6a"], [-1, -2, "#2d3e6e", "#e9c08a", "#e9c08a"],
    [3, -1, "#f2c14e", "#8a5a3c", "#3a4a6a"], [6, 1, "#e98fae", "#e9b48a", "#e9b48a"], [-4, 2, "#d9dde6", "#e9c08a", "#2a2a3a"],
    [1, 2, "#ffffff", "#c68a5e", "#e9c08a"],
  ];

  function collegeLive(g) {
    const { cx } = S;
    // the students, one of them waving now and then
    for (const [i, [dx, dy, shirt, skin, legs]] of STUDENTS.entries()) {
      const x = cx - 1 + dx;
      const y = g + 10 + dy;
      ctx.fillStyle = skin;
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillStyle = shirt;
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y + 2, 1, 1);
      ctx.fillStyle = legs;
      ctx.fillRect(x, y + 3, 3, 1);
      if (i === 1 && !reduced.matches && frame % 48 < 8) {
        ctx.fillStyle = shirt;
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillStyle = skin;
        ctx.fillRect(x - 1, y - 1 - (frame % 4 < 2 ? 0 : 1), 1, 1);
      }
    }
    // an ibis pottering about the lawn
    const b = S.ibis;
    const moving = !reduced.matches && b.rest <= 0;
    if (moving) {
      b.x += b.dir * 0.25;
      if (b.x > cx - 16 || b.x < cx - 50) b.dir *= -1;
      if (frame % 97 === 0) b.rest = 24;
    } else b.rest--;
    pixels(IBIS[moving ? Math.floor(frame / 3) % 2 : 0], { W: C.ibis, K: C.ibisDk }, Math.floor(b.x), g + 6, b.dir > 0);
  }

  function flyers(c) {
    const { W, H } = S;
    for (const f of S.flocks) {
      const y = yAt(f.p, c);
      if (y < -12 || y > H + 12) continue;
      const span = f.n * 10 + 20;
      for (let i = 0; i < f.n; i++) {
        const x = ((Math.floor(f.x) + i * 10 + (i % 2) * 3) % (W + span) + (W + span)) % (W + span) - 20;
        pixels(f.art[(Math.floor(frame / 2) + i) % 2], f.c, x, y + (i % 3) * 3 - ((i * 7) % 5), f.v < 0);
      }
    }
    const py = yAt(S.plane.p, c);
    if (py > -6 && py < H + 6) {
      const x = Math.floor(S.plane.x);
      for (let i = 1; i < 24; i++) {
        if (bayer(x - i, py) < 1 - i / 24) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - i, py + 1, 1, 1);
        }
      }
      pixels(["....w.....", "wwwwwwwwwk", "...ww....."], { w: "#f4f8ff", k: "#5f6f88" }, x, py, false);
    }
    // a shooting star now and then in the night sky
    if (alt > 360) {
      if (!S.meteor && frame % 70 === 0) S.meteor = { x: Math.random() * W, y: Math.random() * H * 0.4, life: 0 };
      const m = S.meteor;
      if (m) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i ? "#a9b4dc" : "#ffffff";
          ctx.fillRect(Math.round(m.x + i * 2), Math.round(m.y - i), 1, 1);
        }
        if (++m.life > 10) S.meteor = null;
      }
    }
  }

  function balloon(c) {
    const yb = yAt(alt, c);
    const aloft = alt > 0.5;
    const bob = aloft && !reduced.matches && Math.floor(frame / 8) % 2 ? 1 : 0;
    const sway = aloft && !reduced.matches ? Math.round(Math.sin(frame * 0.06)) : 0;
    const burn = anim ? frame % 3 !== 0 : aloft && frame % 53 < 4;
    const x = S.bx + sway;
    const y = yb - 30 + bob;
    ctx.drawImage(S.balloon[burn ? 1 : 0], x, y);

    for (const e of effects) {
      const age = frame - e.t0;
      if (e.kind === "rain") ctx.drawImage(icon("miss"), x + 1, y - 18 + (age % 2));
      if (e.kind === "sparkle") {
        for (let i = 0; i < e.n; i++) {
          const a = (i / e.n) * Math.PI * 2 + i;
          const d = 6 + age * (1.6 + (i % 3) * 0.5);
          ctx.fillStyle = i % 3 ? C.goldHi : "#ffffff";
          ctx.fillRect(Math.round(x + 9 + Math.cos(a) * d), Math.round(y + 12 + Math.sin(a) * d * 0.8), 1, 1);
        }
      }
    }
    effects = effects.filter((e) => frame - e.t0 < e.life);
  }

  function draw() {
    if (!S) return;
    const { W, H, camMax } = S;
    const c = camera();
    const top = camMax - c;
    ctx.drawImage(S.sky, 0, top, W, H, 0, 0, W, H);

    for (const [x, row, k] of S.twinkles) {
      const y = row - top;
      if (y < 0 || y >= H) continue;
      const t = (frame + k) % 64;
      ctx.fillStyle = t < 4 ? "#3d4b7a" : t < 40 ? "#ffffff" : "#a9b4dc";
      ctx.fillRect(x, y, 1, 1);
    }
    for (const [x, row, k] of S.sparkles) {
      const y = row - top;
      if (y < -2 || y >= H + 2 || (frame + k) % 40 > 6) continue;
      ctx.fillStyle = "#fff6c8";
      ctx.fillRect(x, y - 1, 1, 3);
      ctx.fillRect(x - 1, y, 3, 1);
    }

    sun();
    moon();

    // Low clouds sit behind the buildings; from the cloud layer up they pass in front of the city.
    const clouds = (high) => {
      for (const cl of S.clouds) {
        if ((cl.p >= 140) !== high) continue;
        const y = yAt(cl.p, c) - cl.cv.height;
        if (y > H || y + cl.cv.height < 0) continue;
        const span = W + cl.cv.width;
        ctx.drawImage(cl.cv, Math.floor(((cl.x % span) + span) % span) - cl.cv.width, y);
      }
    };
    clouds(false);

    // Further things sink more slowly as you rise, so the uni and then the city come into view.
    const farY = S.Gy0 + 10 - S.farH + Math.round(c * 0.18);
    if (farY < H) ctx.drawImage(S.far, 0, farY);
    const midY = S.Gy0 + 34 - S.midG + Math.round(c * 0.35);
    if (midY < H) ctx.drawImage(S.mid, 0, midY);
    const nearY = S.Gy0 - S.nearG + c;
    if (nearY < H) {
      ctx.drawImage(S.near, 0, nearY);
      collegeLive(nearY + S.nearG);
    }
    clouds(true);

    flyers(c);

    for (const w of trail) {
      if (w.tier < 1 || w.a > alt + 0.5) continue;
      const y = yAt(w.a, c) - 22;
      if (y > -16 && y < H) ctx.drawImage(icon(TIER_ICON[w.tier]), S.bx - 20, y);
    }
    balloon(c);
  }

  function tick() {
    if (reduced.matches) return;
    frame++;
    for (const cl of S.clouds) cl.x += cl.v;
    for (const f of S.flocks) f.x += f.v;
    S.plane.x += 0.6;
    if (S.plane.x > S.W + 260) S.plane.x = -40;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (!S) return;
    let moving = false;
    if (anim) {
      const t = anim.dur ? clamp((now - anim.t0) / anim.dur, 0, 1) : 1;
      alt = lerp(anim.from, anim.to, ease(t));
      if (t >= 1) anim = null;
      moving = true;
    }
    if (anchorAnim) {
      const t = clamp((now - anchorAnim.t0) / 700, 0, 1);
      anchor = lerp(anchorAnim.from, anchorAnim.to, ease(t));
      if (t >= 1) anchorAnim = null;
      moving = true;
    }
    const due = now - lastTick >= 125;
    if (due) {
      lastTick = now;
      tick();
    }
    if (moving || due) draw();
  }

  /* ------------------------------- API ------------------------------ */

  function mount(el) {
    canvas = el;
    ctx = canvas.getContext("2d");
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    let t = null;
    let lastW = document.documentElement.clientWidth;
    let lastH = probe.offsetHeight;
    window.addEventListener("resize", () => {
      // Phones fire resize when the keyboard opens; only rebuild when the big viewport changes.
      const w = document.documentElement.clientWidth;
      const h = probe.offsetHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      clearTimeout(t);
      t = setTimeout(build, 150);
    });
    build();
    requestAnimationFrame(loop);
  }

  function setView(v) {
    if (v === view && S) return;
    view = v;
    if (!S) return;
    anchorAnim = { from: anchor, to: anchorFor(v), t0: performance.now() };
  }

  // Fly the balloon to an altitude (0–500 m). Returns how long the climb takes, in ms.
  function climbTo(a, instant) {
    a = clamp(a, 0, TOP);
    if (instant || reduced.matches || !S) {
      alt = a;
      anim = null;
      effects = [];
      draw();
      return 0;
    }
    const dist = Math.abs(a - alt);
    if (!dist) return 0;
    const dur = clamp(500 + dist * 9, 600, 2400);
    anim = { from: alt, to: a, t0: performance.now(), dur };
    return dur;
  }

  function effect(kind) {
    if (reduced.matches) return;
    effects.push(kind === "rain" ? { kind, t0: frame, life: 22 } : { kind: "sparkle", t0: frame, life: 12, n: 18 });
  }

  const urls = new Map();
  function img(name, scale, cls) {
    if (!urls.has(name)) urls.set(name, icon(name).toDataURL());
    const s = 16 * scale;
    return `<img class="spr${cls ? " " + cls : ""}" src="${urls.get(name)}" width="${s}" height="${s}" alt="" aria-hidden="true">`;
  }

  return {
    mount,
    setView,
    climbTo,
    effect,
    setTrail: (list) => { trail = list; },
    tier: (t, scale, cls) => img(TIER_ICON[t], scale, cls),
    sprite: img,
    icon,
  };
})();
