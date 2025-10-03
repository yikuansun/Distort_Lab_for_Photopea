// engine.js
// Read from OFFSCREEN srcCanvas → write to visible #view with zoom.
// Safe fallback: if srcCanvas empty but state.image є — малюємо напряму і гідруємо srcCanvas.

import { state } from "./state.js";
import { getSampler, bilinearSample, edgeResolve } from "./utils.js";
import { drawSource } from "./canvas.js";
import { getFilterById } from "./filters.js";

let srcData = null;
let srcW = 0, srcH = 0;
let lastSourceVersion = -1;

export function render() {
  const { canvas, ctx, srcCanvas, srcCtx, currentFilter, params, viewScale } = state;

  // Fallback: якщо нема джерела, але є state.image — згенерувати його.
  if ((!srcCanvas || srcCanvas.width === 0 || srcCanvas.height === 0) && state.image) {
    // Спроба гідрувати srcCanvas (синхронний виклик — image вже декодований)
    try { drawSource(); } catch (_) {}
  }

  const hasSrc = srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0;
  const img = state.image;

  // Якщо досі нема srcCanvas, але є image — хоч щось покажемо
  if (!hasSrc && img && canvas && ctx) {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w && h) {
      const scale = Math.max(0.01, viewScale || 1);
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));
      if (canvas.width !== outW || canvas.height !== outH) {
        canvas.width = outW; canvas.height = outH;
      }
      ctx.setTransform(scale,0,0,scale,0,0);
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(img, 0, 0);
    }
    return;
  }

  if (!currentFilter || !hasSrc) return;

  // Оновити кеш пікселів при зміні розміру або sourceVersion
  if (!srcData
      || srcW !== srcCanvas.width
      || srcH !== srcCanvas.height
      || lastSourceVersion !== (state.sourceVersion || 0)) {
    srcW = srcCanvas.width;
    srcH = srcCanvas.height;
    lastSourceVersion = state.sourceVersion || 0;
    srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  }

  // Вихідний холст — з урахуванням масштабу
  const scale = Math.max(0.01, viewScale || 1);
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW; canvas.height = outH;
  }

  const dst = ctx.createImageData(outW, outH);
  const dstBuf = dst.data;
  const srcBuf = srcData.data;

  const filt = getFilterById(state.filterId);
  const p = params[state.filterId] || {};

  // Геометричні параметри у координатах джерела
  const center = {
    cx: (p.centerX !== undefined ? (p.centerX / 100) * srcW : srcW * 0.5),
    cy: (p.centerY !== undefined ? (p.centerY / 100) * srcH : srcH * 0.5),
  };
  const radiusPx = (p.radius !== undefined ? (p.radius / 100) * Math.min(srcW, srcH) * 0.5 : Math.min(srcW, srcH));
  const edgeMode = p.edgeMode || "clamp";
  const sampler = getSampler(edgeMode, srcW, srcH, srcBuf);

  // Якщо фільтр не знайдено — просто ресемпл із масштабом
  if (!filt || typeof filt.map !== "function") {
    // просте nearest/bilinear копіювання
    let k = 0;
    for (let y = 0; y < outH; y++) {
      const ys = y / scale;
      for (let x = 0; x < outW; x++, k += 4) {
        const xs = x / scale;
        const xi = Math.max(0, Math.min(srcW - 1, Math.floor(xs)));
        const yi = Math.max(0, Math.min(srcH - 1, Math.floor(ys)));
        const si = (yi * srcW + xi) * 4;
        dstBuf[k+0] = srcBuf[si+0];
        dstBuf[k+1] = srcBuf[si+1];
        dstBuf[k+2] = srcBuf[si+2];
        dstBuf[k+3] = srcBuf[si+3];
      }
    }
    ctx.putImageData(dst, 0, 0);
    return;
  }

  // Основний цикл з геометричним мапінгом
  let i = 0;
  for (let y = 0; y < outH; y++) {
    const yS = y / scale;
    for (let x = 0; x < outW; x++, i += 4) {
      const xS = x / scale;

      const { u, v, aOverride } = filt.map(xS, yS, srcW, srcH, { ...p, ...center, radiusPx });
      const { ux, vy, out } = edgeResolve(u, v, srcW, srcH, edgeMode);

      if (out) {
        dstBuf[i+0]=0; dstBuf[i+1]=0; dstBuf[i+2]=0; dstBuf[i+3]=0;
      } else {
        const rgba = bilinearSample(sampler, ux, vy);
        dstBuf[i+0]=rgba[0]; dstBuf[i+1]=rgba[1]; dstBuf[i+2]=rgba[2]; dstBuf[i+3]=(aOverride!==undefined)?aOverride:rgba[3];
      }
    }
  }
  state.ctx.putImageData(dst, 0, 0);
}
