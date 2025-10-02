export function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
export function wrap(v, n){ v = v % n; if (v<0) v += n; return v; }
export function mirror(v, n){ // 0..n mirrors like |saw|
  const t = Math.abs((v % (2*n)) + (2*n)) % (2*n);
  return t <= n ? t : (2*n - t);
}

export function getSampler(edgeMode, W, H, buf) {
  return { W, H, buf, edgeMode };
}

export function edgeResolve(u, v, W, H, mode) {
  if (mode === "transparent") {
    if (u<0 || v<0 || u>W-1 || v>H-1) return { out:true, ux:0, vy:0 };
    return { out:false, ux:u, vy:v };
  }
  if (mode === "clamp") {
    return { out:false, ux: clamp(u, 0, W-1), vy: clamp(v, 0, H-1) };
  }
  if (mode === "wrap") {
    return { out:false, ux: wrap(u, W), vy: wrap(v, H) };
  }
  if (mode === "mirror") {
    return { out:false, ux: mirror(u, W-1), vy: mirror(v, H-1) };
  }
  return { out:false, ux: clamp(u,0,W-1), vy: clamp(v,0,H-1) };
}

export function bilinearSample(sampler, x, y) {
  const { W, H, buf } = sampler;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0+1, W-1), y1 = Math.min(y0+1, H-1);
  const dx = x - x0, dy = y - y0;

  // index helper
  const idx = (xx, yy) => ((yy * W + xx) << 2);

  const i00 = idx(x0,y0), i10 = idx(x1,y0), i01 = idx(x0,y1), i11 = idx(x1,y1);
  const w00 = (1-dx)*(1-dy), w10 = dx*(1-dy), w01 = (1-dx)*dy, w11 = dx*dy;

  const r = buf[i00]*w00 + buf[i10]*w10 + buf[i01]*w01 + buf[i11]*w11;
  const g = buf[i00+1]*w00 + buf[i10+1]*w10 + buf[i01+1]*w01 + buf[i11+1]*w11;
  const b = buf[i00+2]*w00 + buf[i10+2]*w10 + buf[i01+2]*w01 + buf[i11+2]*w11;
  const a = buf[i00+3]*w00 + buf[i10+3]*w10 + buf[i01+3]*w01 + buf[i11+3]*w11;
  return [r|0, g|0, b|0, a|0];
}

// Optional helper to preload demo
export async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
// export async function loadDefault(){ const img = await loadImage("./assets/test.jpg"); window.state.image = img; }
