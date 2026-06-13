// Verifies death-dot placement is aligned with the base-map texture, with no browser.
//
// The globe is a THREE.SphereGeometry textured with a d3 equirectangular canvas.
// A dot for (lon,lat) is placed at lonLatToVec3(lon,lat). Placement is correct iff
// that 3D point coincides with the geometry vertex whose UV samples the texel where
// the d3 projection drew (lon,lat). So for every real geometry vertex we:
//   1. read its position + uv straight from THREE,
//   2. turn the uv into a canvas pixel (CanvasTexture flipY=true => pixel = (u*W,(1-v)*H)),
//   3. invert the d3 projection to get the (lon,lat) drawn there,
//   4. recompute lonLatToVec3(lon,lat) and compare to the vertex position.
// Max error ~0 => dots land exactly where the map paints that lon/lat.

import * as THREE from "three";
import { geoEquirectangular } from "d3-geo";

const TEX_W = 2048;
const TEX_H = 1024;

const projection = geoEquirectangular()
  .scale(TEX_W / (2 * Math.PI))
  .translate([TEX_W / 2, TEX_H / 2]);

function lonLatToVec3(lon, lat, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

const geo = new THREE.SphereGeometry(1, 64, 64);
const pos = geo.attributes.position;
const uv = geo.attributes.uv;

let maxErr = 0;
let worst = null;
for (let i = 0; i < pos.count; i++) {
  const u = uv.getX(i);
  const v = uv.getY(i);
  // Skip the exact pole rows: THREE nudges their u by half a texel (uOffset),
  // and longitude is meaningless at a pole anyway.
  if (v === 0 || v === 1) continue;

  const px = u * TEX_W;
  const py = (1 - v) * TEX_H;
  const [lon, lat] = projection.invert([px, py]);

  const expected = lonLatToVec3(lon, lat, 1);
  const actual = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  const err = expected.distanceTo(actual);
  if (err > maxErr) {
    maxErr = err;
    worst = { lon: lon.toFixed(2), lat: lat.toFixed(2), err };
  }
}

console.log(`checked ${pos.count} vertices`);
console.log(`max position error: ${maxErr.toExponential(3)} (globe radius = 1)`);
console.log(`worst vertex:`, worst);
console.log(maxErr < 1e-6 ? "PASS — dots are aligned with the texture" : "FAIL — misaligned");
process.exit(maxErr < 1e-6 ? 0 : 1);
