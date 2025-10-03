import { state } from "./state.js";

/** Initialize visible canvas (no-op holder, kept for symmetry). */
export async function initCanvas(){
  const view = document.getElementById("view");
  // Ensure white background and 2D context set with willReadFrequently for filters
  view.getContext("2d", { willReadFrequently: true });
}

/**
 * Rebuild source canvas from state.image.
 * If `force` is true, always recreate / redraw even if dimensions are the same.
 */
export async function drawSource(force = false){
  const img = state.image;
  if (!img) return;

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // If not forcing and size matches, we could early-return.
  // BUT for reliability with Photopea roundtrip we always redraw.
  if (!state.sourceCanvas || force) {
    state.sourceCanvas = document.createElement("canvas");
    state.sourceCtx = state.sourceCanvas.getContext("2d", { willReadFrequently: true });
  }

  state.sourceCanvas.width = w;
  state.sourceCanvas.height = h;
  state.sourceCtx.clearRect(0,0,w,h);
  state.sourceCtx.drawImage(img, 0, 0, w, h);

  // Bump version for debugging / race detection
  state.sourceVersion = (state.sourceVersion || 0) + 1;
  // eslint-disable-next-line no-console
  console.log("%c[DL-LAB]", "color:#58a6ff", `drawSource: ${w}x${h} sourceVersion=${state.sourceVersion}`);
}

/** Fit visible canvas to current image size and view scale. */
export function fitToView(){
  const view = document.getElementById("view");
  if (!state.sourceCanvas) return;
  view.width  = state.sourceCanvas.width;
  view.height = state.sourceCanvas.height;
  state.viewScale = 1;
}

/** Commit filtered result back into sourceCanvas (used by "Commit changes"). */
export function commitToSource(){
  const view = document.getElementById("view");
  if (!state.sourceCanvas) return;
  const w = view.width, h = view.height;
  state.sourceCanvas.width = w;
  state.sourceCanvas.height = h;
  state.sourceCtx.clearRect(0,0,w,h);
  state.sourceCtx.drawImage(view, 0, 0);
  state.sourceCommitted = true;
  state.sourceVersion = (state.sourceVersion || 0) + 1;
}
