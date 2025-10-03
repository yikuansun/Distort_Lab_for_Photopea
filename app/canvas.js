import { state } from "./state.js";

/**
 * Initialize canvas-related state.
 */
export async function initCanvas() {
  state.viewScale = 1;
  state.sourceCanvas = null;
  state.sourceCtx = null;
}

/**
 * Build / rebuild sourceCanvas from state.image.
 * If fromLocal is true, we rebuild immediately from the loaded Image().
 */
export async function drawSource(fromLocal=false) {
  const img = state.image;
  if (!img) return;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  state.sourceCanvas = document.createElement("canvas");
  state.sourceCanvas.width  = w;
  state.sourceCanvas.height = h;
  state.sourceCtx = state.sourceCanvas.getContext("2d", { willReadFrequently: true });
  state.sourceCtx.drawImage(img, 0, 0);
  state.sourceVersion = (state.sourceVersion || 0) + 1;
}

/**
 * Fit-to-view is handled with CSS zoom logic via state.viewScale elsewhere.
 * Here we keep it minimal in case the app uses it directly.
 */
export function fitToView() {
  // No-op here; actual fit is done by the layout zoom controls.
  // This function exists to keep compatibility with existing calls.
}
