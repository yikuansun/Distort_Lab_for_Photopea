import { initState, setFilterId, setParam, state } from "./state.js";
import { initCanvas, drawSource, fitToView, exportPNG, commitToSource } from "./canvas.js";
import { render } from "./engine.js";
import { registry, defaultParamsFor } from "./filters.js";
import { buildParamsPanel } from "./ui.js";

// --- DOM refs ---
const loadBtn       = document.getElementById("loadBtn");
const filterSelect  = document.getElementById("filterSelect");
const paramsPanel   = document.getElementById("paramsPanel");
const fitBtn        = document.getElementById("fitBtn");
const exportBtn     = document.getElementById("exportBtn");
const stageEl       = document.getElementById("stage");
const placeholderEl = document.getElementById("stagePlaceholder");
const canvasEl      = document.getElementById("view");

// Zoom controls
const zoomOutBtn    = document.getElementById("zoomOutBtn");
const zoomInBtn     = document.getElementById("zoomInBtn");
const zoom100Btn    = document.getElementById("zoom100Btn");

// Header / sidebar actions
const commitBtn     = document.getElementById("commitBtn");
const defaultsBtn   = document.getElementById("defaultsBtn");

// Presets UI
const presetNameEl   = document.getElementById("presetName");
const savePresetBtn  = document.getElementById("savePresetBtn");
const loadPresetBtn  = document.getElementById("loadPresetBtn");
const loadPresetFile = document.getElementById("loadPresetFile");

// Photopea export button
const exportToPPBtn  = document.getElementById("exportToPPBtn");

// --- Boot ---
await initState();
await initCanvas();

// Initialize params for all filters
state.params = {};
for (const f of registry) state.params[f.id] = defaultParamsFor(f);

// Populate filter list
for (const f of registry) {
  const opt = document.createElement("option");
  opt.value = f.id;
  opt.textContent = f.name;
  filterSelect.appendChild(opt);
}

// Set initial filter
state.currentFilter = registry[0];
setFilterId(state.currentFilter.id);
filterSelect.value = state.filterId;

// Build params UI
buildParamsPanel(
  paramsPanel,
  state.currentFilter,
  state.params[state.filterId],
  (key, val) => { setParam(state.filterId, key, val); requestRender(); }
);

// Load button → file dialog (lazy input)
let imageChooser = document.createElement("input");
imageChooser.type = "file";
imageChooser.accept = "image/*";
imageChooser.style.display = "none";
document.body.appendChild(imageChooser);

loadBtn.addEventListener("click", () => imageChooser.click());
imageChooser.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await loadFileToState(file);
  e.target.value = "";
});

// Drag & drop on stage
stageEl.addEventListener("dragover", (ev) => { ev.preventDefault(); });
stageEl.addEventListener("drop", async (ev) => {
  ev.preventDefault();
  const file = [...(ev.dataTransfer?.files || [])][0];
  if (file) await loadFileToState(file);
});

// Paste from clipboard
window.addEventListener("paste", async (ev) => {
  const item = [...(ev.clipboardData?.items || [])]
    .find(it => it.type && it.type.startsWith("image/"));
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

// View actions
fitBtn.addEventListener("click", () => { fitToView(); requestRender(); });
exportBtn.addEventListener("click", () => exportPNG());

// Zoom controls
zoom100Btn.addEventListener("click", () => { setScale(1); });
zoomInBtn.addEventListener("click", () => { setScale(state.viewScale * 1.1); });
zoomOutBtn.addEventListener("click", () => { setScale(state.viewScale / 1.1); });
function setScale(newScale) {
  state.viewScale = Math.max(0.05, Math.min(8, newScale || 1));
  requestRender();
}

// Commit current output as new source (bake)
commitBtn.addEventListener("click", () => {
  if (!canvasEl || canvasEl.style.display === "none") return;
  commitToSource();
  fitToView();
  requestRender();
});

// Reset current filter params to defaults
defaultsBtn.addEventListener("click", () => {
  const f = state.currentFilter;
  if (!f) return;
  state.params[state.filterId] = defaultParamsFor(f);

  buildParamsPanel(
    paramsPanel,
    state.currentFilter,
    state.params[state.filterId],
    (key, val) => { setParam(state.filterId, key, val); requestRender(); }
  );
  requestRender();
});

// ---------------- Presets: Save / Load JSON ----------------

savePresetBtn?.addEventListener("click", () => {
  const filterId = state.filterId;
  const params   = state.params[filterId];
  const name     = (presetNameEl?.value || "").trim();

  const payload = {
    type: "distort-lab-preset",
    version: 1,
    filter: filterId,
    name,
    params
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${name || filterId}-preset.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

loadPresetBtn?.addEventListener("click", () => loadPresetFile?.click());

loadPresetFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || data.type !== "distort-lab-preset" || typeof data.params !== "object") {
      alert("Invalid preset file.");
      return;
    }

    if (typeof data.filter === "string" && data.filter !== state.filterId) {
      const found = registry.find(f => f.id === data.filter);
      if (found) {
        state.currentFilter = found;
        setFilterId(found.id);
        filterSelect.value = found.id;
      } else {
        alert(`Filter "${data.filter}" not found in this build.`);
        return;
      }
    }

    const f = state.currentFilter;
    const base = defaultParamsFor(f);
    state.params[state.filterId] = { ...base, ...data.params };

    if (typeof data.name === "string" && presetNameEl) presetNameEl.value = data.name;

    buildParamsPanel(
      paramsPanel,
      state.currentFilter,
      state.params[state.filterId],
      (key, val) => { setParam(state.filterId, key, val); requestRender(); }
    );

    requestRender();
  } catch (err) {
    console.error(err);
    alert("Failed to load preset.");
  } finally {
    e.target.value = "";
  }
});

// ---------------- Loader (common) ----------------

async function loadFileToState(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    state.image = img;
    placeholderEl.style.display = "none";
    canvasEl.style.display = ""; // show canvas

    await drawSource();
    fitToView();
    requestRender();

    URL.revokeObjectURL(url);
  };
  img.crossOrigin = "anonymous";
  img.src = url;
}

// Debounced render
let raf = 0;
function requestRender() {
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => { render(); });
}

// ====================== Photopea roundtrip integration ======================

// Parse sessionId from URL (?sessionId=...)
const sessionId = new URLSearchParams(location.search).get("sessionId") || "";

// Export current output PNG to Photopea (via plugin window)
exportToPPBtn?.addEventListener("click", async () => {
  try {
    const ab = await canvasToArrayBuffer(canvasEl);
    // Prefer posting to the opener (plugin tab). If none - noop.
    const pluginOrigin = "https://pt-home.github.io";
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: "LAB_EXPORT",
        sessionId,
        mime: "image/png",
        name: "distorted.png",
        buffer: ab
      }, pluginOrigin, [ab]); // transfer
    } else {
      alert("Plugin window is not available. Please use the Photopea plugin panel to start a session.");
    }
  } catch (e) {
    console.error(e);
    alert("Failed to export PNG to Photopea.");
  }
});

// Receive images from plugin (LAB_IMAGE) and session open pings (LAB_OPEN)
window.addEventListener("message", async (ev) => {
  const origin = ev.origin;
  if (origin !== "https://pt-home.github.io") return;
  const msg = ev.data || {};
  if (msg.sessionId && sessionId && msg.sessionId !== sessionId) return;

  if (msg.type === "LAB_OPEN") {
    // Acknowledge (optional)
    // console.log("Session confirmed:", sessionId);
    return;
  }
  if (msg.type === "LAB_IMAGE" && msg.buffer instanceof ArrayBuffer) {
    // Load PNG buffer as current source image
    try {
      const blob = new Blob([msg.buffer], { type: msg.mime || "image/png" });
      const file = new File([blob], msg.name || "from-photopea.png", { type: blob.type });
      await loadFileToState(file);
    } catch (e) {
      console.error("Failed to load image from plugin:", e);
    }
  }
});

// Helper: canvas → ArrayBuffer (PNG)
function canvasToArrayBuffer(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas) return reject(new Error("No canvas"));
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("toBlob() failed"));
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsArrayBuffer(blob);
    }, "image/png");
  });
}
