import { state } from "./state.js";

/**
 * Renderer:
 * 1) If filter exposes render(ctx, state) -> call it (fast path).
 * 2) Else run a generic CPU warp:
 *      For each destination pixel (x,y), call filter.map/warp(x,y,state)
 *      to get source coords (u,v) and optional alpha multiplier 'a'.
 *      Sample source (bilinear) with edge mode: clamp | wrap | mirror | transparent.
 */
export function render() {
  const view = document.getElementById("view");
  if (!view) return;

  const src = state?.sourceCanvas;
  if (!src) {
    // No source -> keep whatever is on screen; avoid clearing to prevent flicker.
    return;
  }

  // Keep destination canvas in sync with source; outer UI handles zoom/fit.
  if (view.width !== src.width || view.height !== src.height) {
    view.width  = src.width;
    view.height = src.height;
  }

  const ctx = view.getContext("2d", { willReadFrequently: true });
  const filter = state.currentFilter;

  // Fast path: custom filter renderer
  if (filter && typeof filter.render === "function") {
    filter.render(ctx, state);
    return;
  }

  // Generic CPU warp path
  cpuWarp(ctx, src, filter, state);
}

/* --------------------------- Generic CPU warp --------------------------- */

/**
 * Run a CPU-based warp using filter.map/warp or identity if absent.
 */
function cpuWarp(dstCtx, srcCanvas, filter, st) {
  const W = srcCanvas.width | 0;
  const H = srcCanvas.height | 0;

  // Choose mapping function
  const mapFn = (filter && (filter.map || filter.warp)) || identityMap;

  // Read source one time
  const sCtx  = srcCanvas.getContext("2d", { willReadFrequently: true });
  const sImg  = sCtx.getImageData(0, 0, W, H);
  const sPix  = sImg.data;

  // Prepare destination buffer
  const dImg = dstCtx.createImageData(W, H);
  const dPix = dImg.data;

  // Edge handling
  const edge = st.edgeMode || "clamp";

  // Main loop
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++, o += 4) {
      // Ask filter for source coords (u,v) and optional alpha multiplier 'a'
      const m = mapFn(x, y, st) || _tmpReuse(x, y);
      const u = m.u, v = m.v;
      const aMul = m.a == null ? 1.0 : m.a;

      // Bilinear sample with chosen edge policy
      const rgba = sampleBilinear(sPix, W, H, u, v, edge);

      dPix[o + 0] = rgba[0];
      dPix[o + 1] = rgba[1];
      dPix[o + 2] = rgba[2];
      dPix[o + 3] = Math.max(0, Math.min(255, rgba[3] * aMul));
    }
  }

  // Present
  dstCtx.setTransform(1, 0, 0, 1, 0, 0);
  dstCtx.putImageData(dImg, 0, 0);
}

/* ------------------------------- Helpers ------------------------------- */

function identityMap(x, y/*, st */) { return { u: x, v: y, a: 1 }; }

// Reusable tiny object to avoid GC churn when mapFn returns nothing
const _tmpUV = { u: 0, v: 0, a: 1 };
function _tmpReuse(x, y) { _tmpUV.u = x; _tmpUV.v = y; _tmpUV.a = 1; return _tmpUV; }

/**
 * Bilinear sampling with edge modes.
 * edge: 'clamp' | 'wrap' | 'mirror' | 'transparent'
 */
function sampleBilinear(src, W, H, u, v, edge) {
  // Integer & fractional parts
  let x0 = Math.floor(u), y0 = Math.floor(v);
  const tx = u - x0, ty = v - y0;

  // Neighbors
  let x1 = x0 + 1, y1 = y0 + 1;

  // Normalize coordinates according to edge policy
  const ok00 = resolveEdge(W, H, x0, y0, edge); x0 = ok00.x; y0 = ok00.y;
  const ok10 = resolveEdge(W, H, x1, y0, edge); x1 = ok10.x;
  const ok01 = resolveEdge(W, H, x0, y1, edge); y1 = ok01.y;
  const ok11 = resolveEdge(W, H, x1, y1, edge);

  // If transparent mode and any neighbor is outside -> return zeros
  if (edge === "transparent" && (ok00.t || ok10.t || ok01.t || ok11.t)) {
    return _ZERO;
  }

  // Fetch 4 texels
  const p00 = fetch(src, W, H, x0, y0);
  const p10 = fetch(src, W, H, x1, y0);
  const p01 = fetch(src, W, H, x0, y1);
  const p11 = fetch(src, W, H, x1, y1);

  // Bilinear blend
  const r0 = lerp4(p00, p10, tx);
  const r1 = lerp4(p01, p11, tx);
  return lerp4(r0, r1, ty);
}

const _ZERO = new Uint8ClampedArray([0,0,0,0]);
const _px   = new Uint8ClampedArray(4);
const _lr   = new Uint8ClampedArray(4);

function fetch(src, W, H, x, y) {
  // Clamp as a last resort; resolveEdge() already normalized
  if (x < 0) x = 0; else if (x >= W) x = W - 1;
  if (y < 0) y = 0; else if (y >= H) y = H - 1;
  const i = (y * W + x) << 2;
  _px[0] = src[i    ];
  _px[1] = src[i + 1];
  _px[2] = src[i + 2];
  _px[3] = src[i + 3];
  return _px;
}

function lerp4(a, b, t) {
  _lr[0] = a[0] + (b[0] - a[0]) * t;
  _lr[1] = a[1] + (b[1] - a[1]) * t;
  _lr[2] = a[2] + (b[2] - a[2]) * t;
  _lr[3] = a[3] + (b[3] - a[3]) * t;
  return _lr;
}

/**
 * Normalize (x,y) according to edge mode, return {x,y,t}
 * t=true -> treat as transparent (only for 'transparent' mode).
 */
function resolveEdge(W, H, x, y, edge) {
  if (x >= 0 && x < W && y >= 0 && y < H) return { x, y, t: false };

  switch (edge) {
    case "clamp":
      if (x < 0) x = 0; else if (x >= W) x = W - 1;
      if (y < 0) y = 0; else if (y >= H) y = H - 1;
      return { x, y, t: false };

    case "wrap":
      x = mod(x, W);
      y = mod(y, H);
      return { x, y, t: false };

    case "mirror":
      x = mirrorIndex(x, W);
      y = mirrorIndex(y, H);
      return { x, y, t: false };

    case "transparent":
    default:
      return { x: -1, y: -1, t: true };
  }
}

function mod(i, n) {
  let m = i % n;
  if (m < 0) m += n;
  return m;
}

function mirrorIndex(i, n) {
  if (n <= 1) return 0;
  const p = n - 1;
  let m = Math.abs(i) % (2 * p);
  if (m > p) m = 2 * p - m;
  return m;
}
