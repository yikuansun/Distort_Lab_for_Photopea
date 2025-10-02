/**
 * Standing Wave Interference
 *
 * Two plane waves with directions theta1/theta2 and the same base frequency f.
 * We build a stationary interference pattern:
 *   S = sin(phi1) * sin(phi2)
 * where phi = 2π f * (x cosθ + y sinθ) / L  (L = min(W,H)).
 *
 * Displacement vector has independent angle 'beta' and amplitude A (px):
 *   u = x + A * S * cos(beta)
 *   v = y + A * S * sin(beta)
 *
 * For lattice-like patterns use theta1=0°, theta2=90°. For moiré — close angles.
 */

export default {
  id: "standing",
  name: "Standing Wave",

  params: {
    amplitude: { label: "Amplitude (px)", type: "range", min:-200, max:200, step:1, default:25 },
    frequency: { label: "Frequency (cycles)", type: "range", min:0, max:100, step:1, default:12 },

    theta1: { label: "Wave 1 angle (°)", type: "range", min:-180, max:180, step:1, default:0 },
    theta2: { label: "Wave 2 angle (°)", type: "range", min:-180, max:180, step:1, default:90 },

    beta:   { label: "Displace angle (°)", type: "range", min:-180, max:180, step:1, default:0 },

    // Mix controls overall strength (%), handy for quick A/B
    mix: { label: "Mix (%)", type: "range", min:0, max:200, step:1, default:100 },

    edgeMode: { label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  map(x, y, W, H, p) {
    const L = Math.max(1, Math.min(W, H));
    const k = (p.frequency || 0) * 2 * Math.PI / L;

    const t1 = (p.theta1 || 0) * Math.PI / 180;
    const t2 = (p.theta2 || 0) * Math.PI / 180;

    const phase1 = k * (x * Math.cos(t1) + y * Math.sin(t1));
    const phase2 = k * (x * Math.cos(t2) + y * Math.sin(t2));

    const S = Math.sin(phase1) * Math.sin(phase2);
    const A = (p.amplitude || 0) * (p.mix || 0) / 100;

    const b = (p.beta || 0) * Math.PI / 180;
    const du = A * S * Math.cos(b);
    const dv = A * S * Math.sin(b);

    return { u: x + du, v: y + dv };
  }
};
