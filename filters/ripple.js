export default {
  id: "ripple",
  name: "Ripple",
  params: {
    axis:    { label:"Axis", type:"select", options:["x","y","radial"], default:"x" },
    amp:     { label:"Amplitude (px)", type:"range", min:0, max:200, step:1, default:20 },
    freq:    { label:"Frequency (cycles)", type:"range", min:1, max:40, step:1, default:8 },
    phase:   { label:"Phase (°)", type:"range", min:0, max:360, step:1, default:0 },
    centerX: { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY: { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    edgeMode:{ label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },
  map(x, y, W, H, p) {
    const ph = (p.phase||0)*Math.PI/180;
    if (p.axis === "x") {
      const v = y;
      const u = x + p.amp * Math.sin(2*Math.PI*(p.freq/W)*y + ph);
      return { u, v };
    } else if (p.axis === "y") {
      const u = x;
      const v = y + p.amp * Math.sin(2*Math.PI*(p.freq/H)*x + ph);
      return { u, v };
    } else { // radial
      const dx = x - p.cx, dy = y - p.cy;
      const r = Math.hypot(dx, dy);
      const theta = Math.atan2(dy, dx);
      const r2 = r + p.amp * Math.sin(2*Math.PI*(p.freq/Math.min(W,H))*r + ph);
      const u = p.cx + r2*Math.cos(theta);
      const v = p.cy + r2*Math.sin(theta);
      return { u, v };
    }
  }
};
