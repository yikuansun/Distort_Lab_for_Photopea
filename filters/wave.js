export default {
  id: "wave",
  name: "Wave",
  params: {
    // Sinusoidal displacement along X and Y. Frequency is in "cycles across the image".
    ampX:   { label:"Amplitude X (px)", type:"range", min:-200, max:200, step:1, default:20 },
    freqX:  { label:"Frequency X (cycles)", type:"range", min:0, max:40, step:1, default:6 },
    phaseX: { label:"Phase X (°)", type:"range", min:0, max:360, step:1, default:0 },

    ampY:   { label:"Amplitude Y (px)", type:"range", min:-200, max:200, step:1, default:20 },
    freqY:  { label:"Frequency Y (cycles)", type:"range", min:0, max:40, step:1, default:6 },
    phaseY: { label:"Phase Y (°)", type:"range", min:0, max:360, step:1, default:0 },

    // Choose which axes to affect
    axes:   { label:"Axes", type:"select", options:["both","x","y"], default:"both" },

    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },

  /**
   * Inverse mapping: for each output pixel (x, y), compute source (u, v).
   * Displace X as a function of y and/or x; and Y as a function of x and/or y.
   */
  map(x, y, W, H, p) {
    // Convert UI phases from degrees to radians
    const phx = (p.phaseX || 0) * Math.PI / 180;
    const phy = (p.phaseY || 0) * Math.PI / 180;

    // Frequencies are specified as cycles across the full width/height.
    // Convert to angular frequencies per pixel.
    const wx = (p.freqX || 0) * 2 * Math.PI / Math.max(1, W);
    const wy = (p.freqY || 0) * 2 * Math.PI / Math.max(1, H);

    let u = x, v = y;

    if (p.axes === "both" || p.axes === "x") {
      // Horizontal displacement typically varies with y (classic Wave).
      u = x + (p.ampX || 0) * Math.sin(wy * y + phx);
    }
    if (p.axes === "both" || p.axes === "y") {
      // Vertical displacement typically varies with x.
      v = y + (p.ampY || 0) * Math.sin(wx * x + phy);
    }

    return { u, v };
  }
};
