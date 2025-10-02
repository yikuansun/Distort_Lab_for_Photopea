import { state } from "./state.js";
import { getSampler, bilinearSample, edgeResolve } from "./utils.js";

let srcData = null;
let srcW = 0, srcH = 0;

export function render() {
  const { image, canvas, ctx, srcCanvas, srcCtx, currentFilter, params, viewScale } = state;

  // Must have a filter and some source pixels either from an Image (drawn to srcCanvas)
  // or already present in srcCanvas (after Commit).
  const hasSrc = srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0;
  if (!currentFilter || !hasSrc) return;

  // Refresh source pixels if size changed or first run
  if (!srcData || srcW !== srcCanvas.width || srcH !== srcCanvas.height) {
    srcW = srcCanvas.width;
    srcH = srcCanvas.height;
    srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  }

  // Output canvas dimensions follow the zoom scale
  const scale = Math.max(0.01, viewScale || 1);
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW;
    canvas.height = outH;
  }

  const dst = ctx.createImageData(outW, outH);
  const dstBuf = dst.data;
  const srcBuf = srcData.data;

  const filt = currentFilter;
  const p = params[state.filterId];

  // Centers and radius are in source pixel space
  const center = {
    cx: (p.centerX !== undefined ? (p.centerX / 100) * srcW : srcW * 0.5),
    cy: (p.centerY !== undefined ? (p.centerY / 100) * srcH : srcH * 0.5),
  };
  const radiusPx = (p.radius !== undefined ? (p.radius / 100) * Math.min(srcW, srcH) * 0.5 : Math.min(srcW, srcH));
  const edgeMode = p.edgeMode || "clamp";
  const sampler = getSampler(edgeMode, srcW, srcH, srcBuf);

  // Main loop in OUTPUT (view) pixels, transform to source space for mapping
  let i = 0;
  for (let y = 0; y < outH; y++) {
    const yS = y / scale;
    for (let x = 0; x < outW; x++, i += 4) {
      const xS = x / scale;

      const { u, v, aOverride } = filt.map(xS, yS, srcW, srcH, { ...p, ...center, radiusPx });
      const { ux, vy, out } = edgeResolve(u, v, srcW, srcH, edgeMode);

      if (out) {
        dstBuf[i + 0] = 0; dstBuf[i + 1] = 0; dstBuf[i + 2] = 0; dstBuf[i + 3] = 0;
      } else {
        const rgba = bilinearSample(sampler, ux, vy);
        dstBuf[i + 0] = rgba[0];
        dstBuf[i + 1] = rgba[1];
        dstBuf[i + 2] = rgba[2];
        dstBuf[i + 3] = (aOverride !== undefined) ? aOverride : rgba[3];
      }
    }
  }

  state.ctx.putImageData(dst, 0, 0);
}
