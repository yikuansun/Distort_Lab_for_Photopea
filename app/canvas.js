// canvas.js
// Canvas setup, view helpers, PNG export, and reliable "commit to source".

import { state } from "./state.js";

// Keep references to the main canvas and its 2D context.
let canvas, ctx;

// Guard to prevent overlapping commits (but allows subsequent commits).
let committing = false;

/**
 * Initialize canvas and 2D context.
 */
export async function initCanvas() {
  canvas = document.getElementById("view");
  if (!canvas) throw new Error("#view canvas not found");
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Initialize view scale if not present
  if (typeof state.viewScale !== "number") state.viewScale = 1;
}

/**
 * Draws the current source image into an internal buffer if needed
 * and ensures the visible canvas has correct dimensions for rendering.
 * The actual filter rendering is handled by engine.js -> render().
 */
export async function drawSource() {
  const img = state.image;
  if (!img) return;

  // Ensure canvas has the source size; engine.js handles scaling for view.
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // Clear any previous content; actual filter pass will overwrite anyway.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Adjust view scale to fit the image into the stage (white area).
 * This modifies state.viewScale; engine.js uses it on render().
 */
export function fitToView() {
  const stage = document.getElementById("stage");
  if (!stage || !state.image) return;

  const bounds = stage.getBoundingClientRect();
  const pad = 24; // stage padding
  const availW = Math.max(50, bounds.width - pad * 2);
  const availH = Math.max(50, bounds.height - pad * 2);

  const imgW = state.image.naturalWidth || state.image.width || 1;
  const imgH = state.image.naturalHeight || state.image.height || 1;

  const scale = Math.max(0.05, Math.min(8, Math.min(availW / imgW, availH / imgH)));
  state.viewScale = scale;
}

/**
 * Export visible canvas as PNG (what you see is what you get).
 */
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

/**
 * Commit the current visible output back into the source image.
 * This makes the current canvas pixels become the new state.image.
 * Reliable across multiple sequential commits.
 */
export async function commitToSource() {
  if (!canvas || !state.image) return;
  if (committing) return; // ignore rapid double-clicks; next click will work
  committing = true;

  try {
    // 1) Read current canvas -> Blob
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob() failed"))), "image/png");
    });

    // 2) Create an object URL and Image
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Committed image failed to load"));
      img.src = url;
    });

    // 3) Swap in as the new source & bump revision to kill any caches
    state.image = img;
    state.sourceVersion = (state.sourceVersion || 0) + 1;

    // 4) Resize the canvas to match new source and clear (engine will re-render)
    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 5) Cleanup URL
    URL.revokeObjectURL(url);
  } finally {
    committing = false;
  }
}

/**
 * Expose raw canvas and context for modules that need them.
 */
export function getCanvasRefs() {
  return { canvas, ctx };
}
