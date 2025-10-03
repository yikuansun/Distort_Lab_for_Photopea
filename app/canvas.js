// canvas.js
// Visible canvas (#view), OFFSCREEN source buffer (srcCanvas), PNG export, commit.

import { state } from "./state.js";

let canvas, ctx;        // visible
let srcCanvas, srcCtx;  // offscreen 1:1 source

let committing = false;

/** Init visible and offscreen canvases */
export async function initCanvas() {
  canvas = document.getElementById("view");
  if (!canvas) throw new Error("#view canvas not found");
  ctx = canvas.getContext("2d", { willReadFrequently: true });

  srcCanvas = document.createElement("canvas");
  srcCtx    = srcCanvas.getContext("2d", { willReadFrequently: true });

  if (typeof state.viewScale !== "number") state.viewScale = 1;

  // publish into state so engine can pick them up
  state.canvas = canvas; state.ctx = ctx;
  state.srcCanvas = srcCanvas; state.srcCtx = srcCtx;
}

/** Put current state.image into OFFSCREEN srcCanvas (1:1 pixels) */
export async function drawSource() {
  const img = state.image;
  if (!img) return;

  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return;

  if (srcCanvas.width !== w || srcCanvas.height !== h) {
    srcCanvas.width = w;
    srcCanvas.height = h;
  }
  srcCtx.setTransform(1,0,0,1,0,0);
  srcCtx.clearRect(0,0,w,h);
  srcCtx.drawImage(img, 0, 0, w, h);

  // bump source version so engine refreshes ImageData cache
  state.sourceVersion = (state.sourceVersion || 0) + 1;
}

/** Compute zoom so the image fits the white stage */
export function fitToView() {
  const stage = document.getElementById("stage");
  if (!stage || !state.image) return;

  const bounds = stage.getBoundingClientRect();
  const pad = 24;
  const availW = Math.max(50, bounds.width  - pad*2);
  const availH = Math.max(50, bounds.height - pad*2);

  const imgW = state.image.naturalWidth || state.image.width  || 1;
  const imgH = state.image.naturalHeight|| state.image.height || 1;

  state.viewScale = Math.max(0.05, Math.min(8, Math.min(availW/imgW, availH/imgH)));
}

/** Export what you see */
export function exportPNG(filename = "distort.png") {
  if (!canvas || !canvas.width || !canvas.height) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}

/** Bake current visible result back into srcCanvas (new source) */
export async function commitToSource() {
  if (!canvas) return;
  if (committing) return;
  committing = true;

  try {
    const blob = await new Promise((res, rej)=>{
      canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob() failed")), "image/png");
    });

    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise((res, rej)=>{
      img.onload = res;
      img.onerror = ()=>rej(new Error("Committed image failed to load"));
      img.src = url;
    });

    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;

    if (w && h) {
      if (srcCanvas.width !== w || srcCanvas.height !== h) {
        srcCanvas.width = w; srcCanvas.height = h;
      }
      srcCtx.setTransform(1,0,0,1,0,0);
      srcCtx.clearRect(0,0,w,h);
      srcCtx.drawImage(img, 0, 0, w, h);

      state.image = img; // корисно для fitToView
      state.sourceVersion = (state.sourceVersion || 0) + 1;
    }

    URL.revokeObjectURL(url);
  } finally {
    committing = false;
  }
}

/** Expose refs */
export function getCanvasRefs() {
  return { canvas, ctx, srcCanvas, srcCtx };
}
