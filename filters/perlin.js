/**
 * Perlin Noise Displace (FBM)
 * u = x + Ax * fbm(sx, sy [+ phaseX])
 * v = y + Ay * fbm(sx, sy [+ phaseY])
 *
 * Frequency is in "cycles across min(W,H)". We sample a rotated noise field
 * to avoid axis locking; FBM = sum_{oct} noise()*gain^oct at lacunarity^oct frequency.
 * - 'gain' controls amplitude persistence across octaves (0.5 = classic).
 * - 'normalize' controls whether we divide by total amplitude; if OFF, 'gain'
 *   changes the overall strength a lot more (easier to see).
 */

export default {
  id: "perlin",
  name: "Perlin Noise Displace",

  params: {
    // Displacement in pixels
    ampX: { label: "Amplitude X (px)", type: "range", min:-200, max:200, step:1, default:20 },
    ampY: { label: "Amplitude Y (px)", type: "range", min:-200, max:200, step:1, default:20 },

    // Base frequency in cycles across min(W,H)
    freq: { label: "Frequency (cycles)", type: "range", min:0, max:100, step:1, default:16 },

    // Fractal Brownian Motion
    octaves:    { label: "Octaves",     type: "number", min:1, max:8, step:1, default:5 },
    lacunarity: { label: "Lacunarity",  type: "number", min:1.1, max:4, step:0.1, default:2.0 },
    gain:       { label: "Gain (persistence)", type: "number", min:0.1, max:0.95, step:0.01, default:0.6 },
    normalize:  { label: "Normalize", type: "checkbox", default: true },

    // Field rotation + independent phases for X/Y channels (decorrelate u/v)
    rotate: { label: "Field Rotate (°)", type: "range", min:-180, max:180, step:1, default:15 },
    phaseX: { label: "X Noise Phase",    type: "number", min:0, max:1000, step:0.01, default:0.00 },
    phaseY: { label: "Y Noise Phase",    type: "number", min:0, max:1000, step:0.01, default:0.00 },

    // RNG seed (deterministic)
    seed:   { label: "Seed", type: "number", min:0, max:2147483647, step:1, default:42 },

    // Apply to axes
    axes: { label:"Axes", type:"select", options:["both","x","y"], default:"both" },

    edgeMode: { label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  map(x, y, W, H, p) {
    // Normalize coords to min dimension, then rotate
    const minD = Math.max(1, Math.min(W, H));
    const baseF = (p.freq || 0) / minD; // cycles per pixel

    const ang = (p.rotate || 0) * Math.PI / 180;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = W * 0.5, cy = H * 0.5;

    // Rotated field coords
    const xr = ( (x - cx) * ca - (y - cy) * sa ) * baseF;
    const yr = ( (x - cx) * sa + (y - cy) * ca ) * baseF;

    // Independent channels with their own phase offsets to avoid identical patterns
    const nX = fbm(xr + (p.phaseX || 0),           yr - 0.5 * (p.phaseX || 0), p);
    const nY = fbm(xr + 13.73 + (p.phaseY || 0),   yr - 4.2,                    p);

    let u = x, v = y;
    if (p.axes === "both" || p.axes === "x") u = x + (p.ampX || 0) * nX;
    if (p.axes === "both" || p.axes === "y") v = y + (p.ampY || 0) * nY;

    return { u, v };
  }
};

/* -------------------- Noise helpers (deterministic, fast) -------------------- */

// Simple integer hash (32-bit)
function hash32(i, seed) {
  let x = (i ^ (seed|0)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

// Pseudo-random gradient at integer lattice
function grad(ix, iy, seed) {
  const h = hash32(ix * 374761393 + iy * 668265263, seed);
  // 8 directions on unit circle
  const a = (h & 255) / 256 * 2 * Math.PI;
  return { gx: Math.cos(a), gy: Math.sin(a) };
}

// Quintic fade for Perlin
function fade(t) { return t*t*t*(t*(t*6 - 15) + 10); }

// Classic 2D Perlin gradient noise in [-1,1]
function perlin(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const xf = x - x0, yf = y - y0;

  const g00 = grad(x0,   y0,   seed);
  const g10 = grad(x0+1, y0,   seed);
  const g01 = grad(x0,   y0+1, seed);
  const g11 = grad(x0+1, y0+1, seed);

  const d00 = (xf)     * g00.gx + (yf)     * g00.gy;
  const d10 = (xf-1.0) * g10.gx + (yf)     * g10.gy;
  const d01 = (xf)     * g01.gx + (yf-1.0) * g01.gy;
  const d11 = (xf-1.0) * g11.gx + (yf-1.0) * g11.gy;

  const u = fade(xf), v = fade(yf);
  const ix0 = d00 + u*(d10 - d00);
  const ix1 = d01 + u*(d11 - d01);
  const val = ix0 + v*(ix1 - ix0);

  // Perlin amplitude ~ in [-sqrt(1/2), sqrt(1/2)]; normalize gently
  return Math.max(-1, Math.min(1, val * 1.4142));
}

// Fractal Brownian Motion sum of octaves.
// If p.normalize === true: divide by accumulated amplitude to keep [-1..1].
// If false: do NOT normalize — gain strongly affects strength (more obvious).
function fbm(x, y, p) {
  const oct = Math.max(1, Math.min(8, Math.floor(p.octaves || 1)));
  const lac = Number(p.lacunarity) || 2.0;
  const gain = Number(p.gain) || 0.5;
  const seed = (p.seed|0) >>> 0;
  const doNorm = !!p.normalize;

  let amp = 1.0;
  let fx = x, fy = y;
  let sum = 0, aSum = 0;

  for (let i = 0; i < oct; i++) {
    sum  += amp * perlin(fx, fy, seed + i*1013);
    aSum += amp;
    amp *= gain;
    fx  *= lac;
    fy  *= lac;
  }

  return doNorm ? (sum / (aSum || 1)) : sum;
}
