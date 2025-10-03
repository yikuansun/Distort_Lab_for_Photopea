import { getCanvasRefs } from "./canvas.js";

/**
 * Global application state (single source of truth).
 */
export const state = {
  image: null,                   // HTMLImageElement
  canvas: null, ctx: null,       // visible canvas + 2D context
  srcCanvas: null, srcCtx: null, // offscreen source buffer (original pixels 1:1)
  filterId: null,                // current filter id
  params: {},                    // parameter snapshots per filter id
  currentFilter: null,           // registry entry for the current filter
  viewScale: 1,                  // zoom scale applied to the output canvas
};

export async function initState() {
  const { canvas, ctx, srcCanvas, srcCtx } = getCanvasRefs();
  state.canvas = canvas; state.ctx = ctx;
  state.srcCanvas = srcCanvas; state.srcCtx = srcCtx;

  // Expose for quick debugging (core does not rely on this).
  try { window.state = state; } catch (_) {}
}

export function setFilterId(id) {
  state.filterId = id;
}

export function setParam(fid, key, val) {
  state.params[fid][key] = coerce(val);
}

function coerce(v) {
  if (typeof v === "string" && v.trim() === "") return v;
  if (!isNaN(v) && v !== "") return Number(v);
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}
