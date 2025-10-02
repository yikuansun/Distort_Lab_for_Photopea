/**
 * Fourier Waves: multi-harmonic sinusoidal displacement (partial Fourier series).
 *
 * Mapping (inverse; output → source):
 *   u = x + Σ_i Axi * sin( (2π * fxi / H) * y + phxi )
 *   v = y + Σ_i Ayi * sin( (2π * fyi / W) * x + phyi )
 *
 * Notes:
 * - "classic" mode: horizontal shift depends on y; vertical shift depends on x (like Photoshop Wave).
 * - Amplitudes are in pixels. Frequencies are in "cycles across image" (per full height or width).
 * - Phases are in degrees.
 * - You can disable any harmonic by setting its amplitude to 0.
 */

export default {
  id: "fourier",
  name: "Fourier Waves",

  params: {
    // Mode: classic= u(y), v(x)   |  xy = both depend on both coords (sum of x- and y-driven waves)
    mode:  { label: "Mode", type: "select", options: ["classic","xy"], default: "classic" },

    // --- X-displacement harmonics (affect u) ---
    ampX1:   { label: "X1 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:30 },
    freqX1:  { label: "X1 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:6 },
    phaseX1: { label: "X1 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    ampX2:   { label: "X2 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:0 },
    freqX2:  { label: "X2 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:0 },
    phaseX2: { label: "X2 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    ampX3:   { label: "X3 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:0 },
    freqX3:  { label: "X3 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:0 },
    phaseX3: { label: "X3 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    // --- Y-displacement harmonics (affect v) ---
    ampY1:   { label: "Y1 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:30 },
    freqY1:  { label: "Y1 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:6 },
    phaseY1: { label: "Y1 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    ampY2:   { label: "Y2 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:0 },
    freqY2:  { label: "Y2 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:0 },
    phaseY2: { label: "Y2 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    ampY3:   { label: "Y3 Amplitude (px)", type: "range", min:-200, max:200, step:1, default:0 },
    freqY3:  { label: "Y3 Frequency (cycles)", type:"range", min:0, max:60, step:1, default:0 },
    phaseY3: { label: "Y3 Phase (°)", type:"range", min:0, max:360, step:1, default:0 },

    // Optional overall mix (scales summed displacement)
    mix:     { label: "Mix (%)", type: "range", min:0, max:200, step:1, default:100 },

    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  map(x, y, W, H, p) {
    // Convert degrees to radians once
    const d2r = Math.PI / 180;

    // Angular freqs per pixel (cycles across full size)
    const wy = (n) => (n || 0) * 2 * Math.PI / Math.max(1, H);
    const wx = (n) => (n || 0) * 2 * Math.PI / Math.max(1, W);

    // Sum helpers
    const sumX_y = (yy) => (
      (p.ampX1 || 0) * Math.sin(wy(p.freqX1) * yy + (p.phaseX1 || 0) * d2r) +
      (p.ampX2 || 0) * Math.sin(wy(p.freqX2) * yy + (p.phaseX2 || 0) * d2r) +
      (p.ampX3 || 0) * Math.sin(wy(p.freqX3) * yy + (p.phaseX3 || 0) * d2r)
    );
    const sumY_x = (xx) => (
      (p.ampY1 || 0) * Math.sin(wx(p.freqY1) * xx + (p.phaseY1 || 0) * d2r) +
      (p.ampY2 || 0) * Math.sin(wx(p.freqY2) * xx + (p.phaseY2 || 0) * d2r) +
      (p.ampY3 || 0) * Math.sin(wx(p.freqY3) * xx + (p.phaseY3 || 0) * d2r)
    );

    const mix = (p.mix || 0) / 100;

    let u = x;
    let v = y;

    if (p.mode === "classic") {
      // u depends on y (horizontal ripples), v depends on x (vertical ripples)
      u = x + mix * sumX_y(y);
      v = y + mix * sumY_x(x);
    } else {
      // "xy": both depend on both axes (richer patterns)
      u = x + mix * (sumX_y(y) + sumX_y(x));
      v = y + mix * (sumY_x(x) + sumY_x(y));
    }

    return { u, v };
  }
};
