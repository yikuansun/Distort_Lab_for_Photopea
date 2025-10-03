import { state } from "./state.js";

/**
 * Visible canvas used for the final, distorted image.
 */
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

/**
 * Offscreen source buffer where the original image is kept 1:1.
 * All filters sample from this buffer.
 */
const srcCanvas = document.createElement("canvas");
const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });

export async function initCanvas() {
  // No-op for now.
}

/**
 * Provide canvas references to other modules.
 */
export function getCanvasRefs() {
  return { canvas, ctx, srcCanvas, srcCtx };
}

/**
 * Draw the currently loaded image 1:1 into the offscreen source buffer.
 * Does NOT change the view scale; call fitToView() separately when needed.
 */
export async function drawSource() {
  const img = state.image;
  if (!img) return;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  srcCanvas.width = w;
  srcCanvas.height = h;
  srcCtx.clearRect(0, 0, w, h);
  srcCtx.drawImage(img, 0, 0);
}

/**
 * Compute a 'fit-to-view' scale for the visible canvas and store it.
 * Render will use this scale to size the output canvas.
 */
export function fitToView() {
  const w = state.srcCanvas.width;
  const h = state.srcCanvas.height;
  if (!w || !h) return;

  const stageEl = document.getElementById("stage");
  const rect = stageEl.getBoundingClientRect();

  const PAD = 24;
  const availW = Math.max(1, rect.width  - PAD);
  const availH = Math.max(1, rect.height - PAD);

  const scaleX = availW / w;
  const scaleY = availH / h;
  const scale = Math.max(0.01, Math.min(scaleX, scaleY));

  state.viewScale = scale;
}

/**
 * Export the visible canvas as a PNG.
 */
export function exportPNG() {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "distort.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL?.(url);
}

/**
 * Commit current visible result as the new source.
 * Copies the displayed canvas pixels into srcCanvas at 1:1 and
 * makes subsequent filters operate on this committed version.
 */
export function commitToSource() {
  // Use current output size
  const outW = canvas.width;
  const outH = canvas.height;
  if (!outW || !outH) return;

  // Resize source buffer to match current output and copy pixels
  srcCanvas.width = outW;
  srcCanvas.height = outH;
  srcCtx.clearRect(0, 0, outW, outH);
  srcCtx.drawImage(canvas, 0, 0);

  // Clear original image handle (we now rely on srcCanvas)
  state.image = null;
}
