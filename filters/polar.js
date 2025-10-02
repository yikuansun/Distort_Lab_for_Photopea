export default {
  id: "polar",
  name: "Polar Coordinates",
  params: {
    direction: { label:"Direction", type:"select", options:["rect→polar","polar→rect"], default:"rect→polar" },
    centerX:   { label:"Center X (%)", type:"range", min:0, max:100, step:1, default:50 },
    centerY:   { label:"Center Y (%)", type:"range", min:0, max:100, step:1, default:50 },
    edgeMode:  { label:"Edges", type:"select", options:["clamp","wrap","mirror","transparent"], default:"clamp" }
  },
  map(x, y, W, H, p) {
    const cx = p.cx, cy = p.cy;
    if (p.direction === "rect→polar") {
      // Output is polar bitmap: u ~ angle, v ~ radius
      const dx = x - cx, dy = y - cy;
      const r = Math.hypot(dx,dy);
      const theta = Math.atan2(dy, dx); // -pi..pi
      const u = (theta + Math.PI) / (2*Math.PI) * W;
      const v = r / Math.hypot(Math.max(cx, W-cx), Math.max(cy, H-cy)) * H;
      return { u, v };
    } else {
      // polar→rect : interpret (x,y) of output as (theta,r) in input
      const theta = (x / W) * 2*Math.PI - Math.PI;
      const Rmax = Math.hypot(Math.max(cx, W-cx), Math.max(cy, H-cy));
      const r = (y / H) * Rmax;
      const u = cx + r*Math.cos(theta);
      const v = cy + r*Math.sin(theta);
      return { u, v };
    }
  }
};
