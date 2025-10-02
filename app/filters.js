import ripple        from "../filters/ripple.js";
import wave          from "../filters/wave.js";
import fourier       from "../filters/fourier.js";
import twirl         from "../filters/twirl.js";
import pinch         from "../filters/pinch.js";
import shear         from "../filters/shear.js";
import zigzag        from "../filters/zigzag.js";
import spherize      from "../filters/spherize.js";
import polar         from "../filters/polar.js";
import mobius        from "../filters/mobius.js";
import expFilter     from "../filters/exp.js";
import logFilter     from "../filters/log.js";
import powFilter     from "../filters/pow.js";
import spiral        from "../filters/spiral.js";
import angular       from "../filters/angular.js";
import hyperbolic    from "../filters/hyperbolic.js";
import perlin        from "../filters/perlin.js";
import standing      from "../filters/standing.js";
import stereographic from "../filters/stereographic.js";
import weierstrass   from "../filters/weierstrass.js";
import cayley        from "../filters/cayley.js";
import joukowski     from "../filters/joukowski.js";
import blaschke      from "../filters/blaschke.js";
import scSquare      from "../filters/sc_square.js";
import droplets      from "../filters/droplets.js";      


export const registry = [
  angular,
  blaschke,
  cayley,
  droplets,
  expFilter,
  fourier,
  hyperbolic,
  joukowski,    
  logFilter,
  mobius,  
  perlin,
  pinch,
  polar,
  powFilter, 
  ripple,
  stereographic,
  scSquare,
  shear,  
  spherize,
  spiral,
  standing,
  twirl,  
  wave,  
  weierstrass,  
  zigzag  
];

export function defaultParamsFor(filter) {
  const o = {};
  for (const [k, def] of Object.entries(filter.params || {})) o[k] = def.default;
  return o;
}
