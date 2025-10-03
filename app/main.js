import { initState, setFilterId, setParam, state } from "./state.js";
import { initCanvas, drawSource, fitToView, exportPNG, commitToSource } from "./canvas.js";
import { render } from "./engine.js";
import { registry, defaultParamsFor } from "./filters.js";
import { buildParamsPanel } from "./ui.js";

// ---------- DOM ----------
const loadBtn       = document.getElementById("loadBtn");
const filterSelect  = document.getElementById("filterSelect");
const paramsPanel   = document.getElementById("paramsPanel");
const fitBtn        = document.getElementById("fitBtn");
const exportBtn     = document.getElementById("exportBtn");
const stageEl       = document.getElementById("stage");
const placeholderEl = document.getElementById("stagePlaceholder");
const canvasEl      = document.getElementById("view");

const zoomOutBtn    = document.getElementById("zoomOutBtn");
const zoomInBtn     = document.getElementById("zoomInBtn");
const zoom100Btn    = document.getElementById("zoom100Btn");

// New: header button to copy canvas at enforced 100% (keeps 100% afterwards)
const copyClipboard100Btn = document.getElementById("copyClipboard100Btn");

const commitBtn     = document.getElementById("commitBtn");
const defaultsBtn   = document.getElementById("defaultsBtn");

// Presets
const presetNameEl   = document.getElementById("presetName");
const savePresetBtn  = document.getElementById("savePresetBtn");
const loadPresetBtn  = document.getElementById("loadPresetBtn");
const loadPresetFile = document.getElementById("loadPresetFile");

// Photopea export button (unchanged)
const exportToPPBtn  = document.getElementById("exportToPPBtn");

// ---------- Logging ----------
const LL = (...a)=>console.log("%c[DL-LAB]", "color:#58a6ff", ...a);
const LP = (...a)=>console.log("%c[DL-PLUGIN]", "color:#9aa0a6", ...a);

// ---------- Anti-race state ----------
let lastSeqApplied = -1;
let currentLoadId  = 0;

// ---------- Boot ----------
await initState();
await initCanvas();

// Init params
state.params = {};
for (const f of registry) state.params[f.id] = defaultParamsFor(f);

// Filter list
for (const f of registry) {
  const opt = document.createElement("option");
  opt.value = f.id;
  opt.textContent = f.name;
  filterSelect.appendChild(opt);
}
state.currentFilter = registry[0];
setFilterId(state.currentFilter.id);
filterSelect.value = state.filterId;

// Build UI for current filter
buildParamsPanel(
  paramsPanel,
  state.currentFilter,
  state.params[state.filterId],
  (key, val) => { setParam(state.filterId, key, val); requestRender(); }
);

// Loaders
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

// Filter change
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

// View actions (unchanged)
fitBtn?.addEventListener("click", () => { fitToView(); requestRender(); });
exportBtn?.addEventListener("click", () => exportPNG());
zoom100Btn?.addEventListener("click", () => setScale(1));
zoomInBtn?.addEventListener("click", () => setScale(state.viewScale * 1.1));
zoomOutBtn?.addEventListener("click", () => setScale(state.viewScale / 1.1));
function setScale(s){ state.viewScale = Math.max(0.05, Math.min(8, s||1)); requestRender(); }

// NEW: Copy visible canvas to clipboard at enforced 100% (and keep 100% afterwards)
copyClipboard100Btn?.addEventListener("click", async ()=>{
  if (!canvasEl || canvasEl.style.display === "none" || !state.image) {
    alert("Load an image first.");
    return;
  }
  const btn = copyClipboard100Btn;
  const prevText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Copying…";
  try {
    // Force 100% zoom and re-render before grabbing pixels
    state.viewScale = 1;
    await forceNextPaint();

    const blob = await canvasToBlob(canvasEl, "image/png");
    await writeImageToClipboard(blob);

    btn.textContent = "Copied!";
    // NOTE: we intentionally keep zoom at 100%
  } catch (err) {
    console.error(err);
    // Fallback: download PNG if clipboard is unavailable
    try {
      const blob = await canvasToBlob(canvasEl, "image/png");
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: "canvas-100.png" });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      btn.textContent = "Downloaded (fallback)";
    } catch (e2) {
      alert("Failed to copy or download PNG.");
      btn.textContent = prevText;
    }
  } finally {
    setTimeout(()=>{ btn.disabled = false; btn.textContent = prevText; }, 900);
  }
});

// Commit: await the commit to reliably enable repeated commits
commitBtn?.addEventListener("click", async () => {
  if (!canvasEl || canvasEl.style.display === "none") return;
  commitBtn.disabled = true;
  try {
    await commitToSource();
    fitToView();
    requestRender();
  } finally {
    commitBtn.disabled = false;
  }
});

// Defaults (unchanged)
defaultsBtn?.addEventListener("click", () => {
  const f = state.currentFilter; if (!f) return;
  state.params[state.filterId] = defaultParamsFor(f);
  buildParamsPanel(
    paramsPanel, f, state.params[state.filterId],
    (k,v)=>{ setParam(state.filterId,k,v); requestRender(); }
  );
  requestRender();
});

// Presets (unchanged)
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

// Common loader (unchanged)
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

// Debounced render (unchanged)
let raf=0; function requestRender(){ if (raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>render()); }

// Ensure next paint happens after enforcing 100%
function forceNextPaint(){
  return new Promise(resolve=>{
    requestRender();
    requestAnimationFrame(()=> requestAnimationFrame(resolve));
  });
}

// Canvas → Blob
function canvasToBlob(canvas, mime="image/png"){
  return new Promise((resolve, reject)=>{
    if (!canvas) return reject(new Error("No canvas"));
    canvas.toBlob((blob)=>{
      if (!blob) return reject(new Error("toBlob() failed"));
      resolve(blob);
    }, mime);
  });
}

// Clipboard write helper
async function writeImageToClipboard(blob){
  if (navigator.clipboard && window.ClipboardItem) {
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
  } else {
    throw new Error("Clipboard API not available");
  }
}

// ================== Photopea roundtrip integration (unchanged) ==================
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

window.addEventListener("message", async (ev)=>{
  const origin = ev.origin;
  if (origin !== "https://pt-home.github.io") return;
  const msg = ev.data || {};
  if (msg.sessionId && sessionId && msg.sessionId !== sessionId) return;

  if (msg.type === "LAB_OPEN") {
    LL("← LAB_OPEN (ack already sent as LAB_READY)");
    return;
  }

  if (msg.type === "LAB_IMAGE" && msg.buffer instanceof ArrayBuffer) {
    const seq = typeof msg.seq === "number" ? msg.seq : -1;
    if (seq <= lastSeqApplied) {
      LL("← LAB_IMAGE (stale) seq="+seq+" ≤ last="+lastSeqApplied);
      return;
    }
    const loadId = ++currentLoadId;
    LL("← LAB_IMAGE seq="+seq+", bytes="+msg.buffer.byteLength+", loadId="+loadId);
    try{
      const blob = new Blob([msg.buffer], { type: msg.mime || "image/png" });
      const file = new File([blob], msg.name || "from-photopea.png", { type: blob.type });
      await loadFileToState(file);
      if (loadId !== currentLoadId) {
        LL("skip apply (superseded) loadId="+loadId+" current="+currentLoadId);
        return;
      }
      lastSeqApplied = seq;
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type:"LAB_IMAGE_APPLIED", sessionId, seq }, "https://pt-home.github.io");
        LL("→ LAB_IMAGE_APPLIED seq="+seq);
      }
    }catch(e){
      console.error("Failed to load image from plugin:", e);
    }
  }
});

// Export current output PNG to Photopea (new document)
exportToPPBtn?.addEventListener("click", async ()=>{
  try{
    const ab = await canvasToArrayBuffer(canvasEl);
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type:"LAB_EXPORT", sessionId, mime:"image/png", name:"distorted.png", buffer: ab }, "https://pt-home.github.io", [ab]);
      LP("→ LAB_EXPORT", ab.byteLength, "bytes");
    } else {
      alert("Plugin window is not available. Please start from the Photopea plugin panel.");
    }
  }catch(e){ console.error(e); alert("Failed to export PNG to Photopea."); }
});

// Helper: canvas → ArrayBuffer (for Photopea export)
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
