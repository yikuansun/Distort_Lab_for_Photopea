import { initState, setFilterId, setParam, state } from "./state.js";
import { initCanvas, drawSource, fitToView, exportPNG, commitToSource } from "./canvas.js";
import { render } from "./engine.js";
import { registry, defaultParamsFor } from "./filters.js";
import { buildParamsPanel } from "./ui.js";

const loadBtn       = document.getElementById("loadBtn");
const filterSelect  = document.getElementById("filterSelect");
const paramsPanel   = document.getElementById("paramsPanel");
const fitBtn        = document.getElementById("fitBtn");
const exportToPPBtn = document.getElementById("exportToPPBtn");
const copyBtn       = document.getElementById("copyBtn");

const stageEl       = document.getElementById("stage");
const placeholderEl = document.getElementById("stagePlaceholder");
const canvasEl      = document.getElementById("view");

const zoomOutBtn    = document.getElementById("zoomOutBtn");
const zoomInBtn     = document.getElementById("zoomInBtn");
const zoom100Btn    = document.getElementById("zoom100Btn");

const commitBtn     = document.getElementById("commitBtn");
const defaultsBtn   = document.getElementById("defaultsBtn");

const presetNameEl   = document.getElementById("presetName");
const savePresetBtn  = document.getElementById("savePresetBtn");
const loadPresetBtn  = document.getElementById("loadPresetBtn");
const loadPresetFile = document.getElementById("loadPresetFile");

const LL = (...a)=>console.log("%c[DL-LAB]", "color:#58a6ff", ...a);
const LP = (...a)=>console.log("%c[DL-PLUGIN]", "color:#9aa0a6", ...a);

let lastSeqApplied = -1;
let currentLoadId  = 0;

await initState();
await initCanvas();

state.params = {};
for (const f of registry) state.params[f.id] = defaultParamsFor(f);

for (const f of registry) {
  const opt = document.createElement("option");
  opt.value = f.id;
  opt.textContent = f.name;
  filterSelect.appendChild(opt);
}
state.currentFilter = registry[0];
setFilterId(state.currentFilter.id);
filterSelect.value = state.filterId;

buildParamsPanel(
  paramsPanel,
  state.currentFilter,
  state.params[state.filterId],
  (key, val) => { setParam(state.filterId, key, val); requestRender(); }
);

let imageChooser = document.createElement("input");
imageChooser.type = "file";
imageChooser.accept = "image/*";
imageChooser.style.display = "none";
document.body.appendChild(imageChooser);

loadBtn?.addEventListener("click", () => imageChooser.click());
imageChooser.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (file) await loadFileToState(file);
  e.target.value = "";
});

stageEl.addEventListener("dragover", (ev) => { ev.preventDefault(); });
stageEl.addEventListener("drop", async (ev) => {
  ev.preventDefault();
  const file = [...(ev.dataTransfer?.files || [])][0];
  if (file) await loadFileToState(file);
});

window.addEventListener("paste", async (ev) => {
  const item = [...(ev.clipboardData?.items || [])].find(it => it.type?.startsWith("image/"));
  if (!item) return;
  const file = item.getAsFile();
  if (file) await loadFileToState(file);
});

async function loadFileToState(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async ()=>{
    state.image = img;
    placeholderEl.style.display = "none";
    canvasEl.style.display = "";
    await drawSource();
    fitToView(); requestRender();
    URL.revokeObjectURL(url);
  };
  img.crossOrigin = "anonymous";
  img.src = url;
}

filterSelect.addEventListener("change", () => {
  const id = filterSelect.value;
  state.currentFilter = registry.find(f => f.id === id);
  setFilterId(id);
  buildParamsPanel(
    paramsPanel,
    state.currentFilter,
    state.params[state.filterId],
    (key, val) => { setParam(state.filterId, key, val); requestRender(); }
  );
  requestRender();
});

fitBtn?.addEventListener("click", () => { fitToView(); requestRender(); });
zoom100Btn?.addEventListener("click", () => setScale(1));
zoomInBtn?.addEventListener("click", () => setScale(state.viewScale * 1.1));
zoomOutBtn?.addEventListener("click", () => setScale(state.viewScale / 1.1));
function setScale(s){ state.viewScale = Math.max(0.05, Math.min(8, s||1)); requestRender(); }

commitBtn?.addEventListener("click", () => {
  if (!canvasEl || canvasEl.style.display === "none") return;
  commitToSource(); fitToView(); requestRender();
});

defaultsBtn?.addEventListener("click", () => {
  const f = state.currentFilter; if (!f) return;
  state.params[state.filterId] = defaultParamsFor(f);
  buildParamsPanel(
    paramsPanel, f, state.params[state.filterId],
    (k,v)=>{ setParam(state.filterId,k,v); requestRender(); }
  );
  requestRender();
});

savePresetBtn?.addEventListener("click", () => {
  const payload = { type:"distort-lab-preset", version:1, filter:state.filterId, name:(presetNameEl?.value||"").trim(), params: state.params[state.filterId] };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href:url, download: `${payload.name || payload.filter}-preset.json` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
loadPresetBtn?.addEventListener("click", ()=> loadPresetFile?.click());
loadPresetFile?.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if (!file) return;
  try{
    const data = JSON.parse(await file.text());
    if (data?.type !== "distort-lab-preset") throw new Error("Invalid preset");
    if (data.filter && data.filter !== state.filterId){
      const found = registry.find(f => f.id === data.filter);
      if (!found) throw new Error(`Filter "${data.filter}" not found`);
      state.currentFilter = found; setFilterId(found.id); filterSelect.value = found.id;
    }
    const base = defaultParamsFor(state.currentFilter);
    state.params[state.filterId] = { ...base, ...(data.params||{}) };
    if (typeof data.name === "string" && presetNameEl) presetNameEl.value = data.name;
    buildParamsPanel(paramsPanel, state.currentFilter, state.params[state.filterId], (k,v)=>{ setParam(state.filterId,k,v); requestRender(); });
    requestRender();
  }catch(err){ alert("Failed to load preset."); console.error(err); }
  finally{ e.target.value=""; }
});

let raf=0; function requestRender(){ if (raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>render()); }

// ===== Photopea integration =====
const sessionId = new URLSearchParams(location.search).get("sessionId") || "";
function announceReady(){
  try{
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type:"LAB_READY", sessionId }, "https://pt-home.github.io");
      LL("→ LAB_READY");
    }
  }catch(e){ console.warn(e); }
}
window.addEventListener("DOMContentLoaded", announceReady);

function crc32_ab(ab){
  let crc = 0 ^ (-1);
  const view = new Uint8Array(ab);
  for (let i=0; i<view.length; i++){
    crc = (crc ^ view[i]) >>> 0;
    for (let j=0;j<8;j++){
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xEDB88320 & mask);
    }
  }
  return (crc ^ (-1)) >>> 0;
}

window.addEventListener("message", async (ev)=>{
  if (ev.origin !== "https://pt-home.github.io") return;
  const msg = ev.data || {};
  if (msg.sessionId && sessionId && msg.sessionId !== sessionId) return;

  if (msg.type === "LAB_OPEN") {
    LL("← LAB_OPEN (ack already sent as LAB_READY)");
    return;
  }

  if (msg.type === "LAB_IMAGE" && msg.buffer instanceof ArrayBuffer) {
    const seq = typeof msg.seq === "number" ? msg.seq : -1;
    if (seq <= lastSeqApplied) { LL("← LAB_IMAGE (stale) seq="+seq+" ≤ last="+lastSeqApplied); return; }

    const loadId = ++currentLoadId;
    const crcHere = crc32_ab(msg.buffer);
    LL(`← LAB_IMAGE seq=${seq}, bytes=${msg.buffer.byteLength}, loadId=${loadId}, crc=${crcHere}` + (msg.crc ? ` (plugin=${msg.crc})` : ""));

    // Hard reset before new image
    try {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
      if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      canvasEl.width = 0; canvasEl.height = 0;
      placeholderEl.style.display = ""; canvasEl.style.display = "none";
      state.image = null; state.sourceCommitted = null; state.sourceCanvas = null; state.sourceCtx = null;
    } catch(e) { console.warn("Reset failed:", e); }

    try{
      // Decode exactly як при локальному Open: через <img> і ObjectURL
      const blob = new Blob([msg.buffer], { type: msg.mime || "image/png" });
      const url  = URL.createObjectURL(blob);

      await new Promise((res)=>{
        const img = new Image();
        img.onload = async ()=>{
          URL.revokeObjectURL(url);
          state.image = img;

          placeholderEl.style.display = "none";
          canvasEl.style.display = "";

          await drawSource();              // готуємо пайплайн
          if (loadId !== currentLoadId) {  // захист від змагань
            LL("skip apply (superseded) loadId="+loadId+" current="+currentLoadId);
            return res();
          }
          fitToView();
          requestRender();

          lastSeqApplied = seq;
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type:"LAB_IMAGE_APPLIED", sessionId, seq }, "https://pt-home.github.io");
            LL("→ LAB_IMAGE_APPLIED seq="+seq);
          }
          res();
        };
        img.crossOrigin = "anonymous";
        img.src = url;
      });
    }catch(e){
      console.error("Failed to load image from plugin:", e);
    }
  }
});

// ---------- Export to Photopea ----------
exportToPPBtn?.addEventListener("click", async ()=>{
  try{
    const ab = await canvasToArrayBuffer(canvasEl);
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type:"LAB_EXPORT", sessionId, mime:"image/png", name:"distorted.png", buffer: ab }, "https://pt-home.github.io", [ab]);
      LP("→ LAB_EXPORT", ab.byteLength, "bytes");
      try { window.opener.focus(); } catch {}
    } else {
      alert("Plugin window is not available. Please start from the Photopea plugin panel.");
    }
  }catch(e){ console.error("Failed to export PNG to Photopea."); alert("Failed to export PNG to Photopea."); }
});

// ---------- Copy original size ----------
copyBtn?.addEventListener("click", async ()=>{
  if (!canvasEl || !state.image) return;
  try{
    const blob = await exportOriginalBlobFromVisibleCanvas();
    await navigator.clipboard.write([ new ClipboardItem({ "image/png": blob }) ]);
    LL("Copied PNG to clipboard (original size).");
  }catch(err){
    console.warn("Clipboard write failed, falling back to Photopea export.", err);
    try{
      const ab = await exportOriginalArrayBufferFromVisibleCanvas();
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type:"LAB_EXPORT", sessionId, mime:"image/png", name:"distorted.png", buffer: ab }, "https://pt-home.github.io", [ab]);
        LP("→ LAB_EXPORT (fallback)", ab.byteLength, "bytes");
        try { window.opener.focus(); } catch {}
      } else {
        const blob2 = new Blob([ab], { type: "image/png" });
        const url = URL.createObjectURL(blob2);
        const a = Object.assign(document.createElement("a"), { href:url, download:"distorted.png" });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }
    }catch(e){ console.error("Fallback export failed.", e); }
  }
});

function canvasToArrayBuffer(canvas){
  return new Promise((resolve,reject)=>{
    if (!canvas) return reject(new Error("No canvas"));
    canvas.toBlob((blob)=>{
      if (!blob) return reject(new Error("toBlob() failed"));
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = reject;
      fr.readAsArrayBuffer(blob);
    }, "image/png");
  });
}
function canvasToBlob(canvas){
  return new Promise((resolve,reject)=>{
    if (!canvas) return reject(new Error("No canvas"));
    canvas.toBlob((blob)=>{
      if (!blob) return reject(new Error("toBlob() failed"));
      resolve(blob);
    }, "image/png");
  });
}
async function exportOriginalBlobFromVisibleCanvas(){
  const { image } = state;
  if (!image) throw new Error("No image loaded");
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  const prevW = canvasEl.width, prevH = canvasEl.height, prevScale = state.viewScale;
  canvasEl.width = naturalW; canvasEl.height = naturalH; state.viewScale = 1;
  await nextRafPaint();
  const blob = await canvasToBlob(canvasEl);
  canvasEl.width = prevW; canvasEl.height = prevH; state.viewScale = prevScale;
  await nextRafPaint();
  return blob;
}
async function exportOriginalArrayBufferFromVisibleCanvas(){
  const blob = await exportOriginalBlobFromVisibleCanvas();
  return await blob.arrayBuffer();
}
function nextRafPaint(){
  return new Promise((res)=>{
    requestAnimationFrame(()=>{
      render();
      requestAnimationFrame(()=>res());
    });
  });
}
