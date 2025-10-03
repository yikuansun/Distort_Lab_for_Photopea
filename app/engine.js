import { state } from "./state.js";

/**
 * Minimal renderer:
 * - If no sourceCanvas → nothing to draw, keep current frame.
 * - If a filter provides .render(ctx), call it with current state.
 * - Otherwise, just blit sourceCanvas into the visible canvas.
 */
export function render() {
  const view = document.getElementById("view");
  if (!view) return;

  const ctx = view.getContext("2d", { willReadFrequently: true });
  if (!state?.sourceCanvas) {
    // No valid source – do not clear the canvas to avoid flashing white
    return;
  }

  // Always keep view the same size as source; scale is applied by CSS/fit logic
  if (view.width !== state.sourceCanvas.width || view.height !== state.sourceCanvas.height) {
    view.width  = state.sourceCanvas.width;
    view.height = state.sourceCanvas.height;
  }

  // If a filter has its own high-level renderer, defer to it
  const filter = state.currentFilter;
  if (filter && typeof filter.render === "function") {
    filter.render(ctx, state);
    return;
  }

  // Default path: draw the source as-is
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0, 0, view.width, view.height);
  ctx.drawImage(state.sourceCanvas, 0, 0);
}
