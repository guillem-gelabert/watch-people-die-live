// TSL node materials for the realistic earth, ported from three.js's
// `webgpu_tsl_earth` example: day/night blend by sun orientation, cloud
// brightening, bump-mapped relief, roughness-driven specular, and a fresnel
// atmosphere — plus an expanding-ripple UV refraction per death blast (our
// addition, matching the old GLSL version). Built with three/webgpu + three/tsl.
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial, BackSide, Vector2 } from "three";
import {
  Fn,
  Loop,
  uniformArray,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  color,
  uv,
  texture,
  mix,
  max,
  step,
  normalize,
  positionWorld,
  cameraPosition,
  normalWorldGeometry,
  bumpMap,
  output,
} from "three/tsl";

// Returns the globe + atmosphere node materials plus the uniforms/arrays the
// frame loop drives (sun direction and the active death shockwaves).
export function createEarth({
  dayTexture,
  nightTexture,
  bumpRoughnessCloudsTexture,
  sunDirection, // THREE.Vector3, unit, in the texture/world frame
  atmosphereDayColor, // hex string
  atmosphereTwilightColor, // hex string
  nBlasts,
  blastMaxR,
  blastWidth,
  blastAmp,
}) {
  // Uniforms driven from app.js each frame / minute.
  const sunDir = uniform(sunDirection.clone());
  const atmDayColor = uniform(color(atmosphereDayColor));
  const atmTwilightColor = uniform(color(atmosphereTwilightColor));
  const roughnessLow = uniform(0.25);
  const roughnessHigh = uniform(0.35);

  // Active death shockwaves: centres in texture UV, progress 0->1 over life.
  // UniformArrayNode re-uploads from `.array` every render, so the frame loop
  // just mutates blastUv.array[i] / blastProg.array[i] / blastCount.value.
  const blastUv = uniformArray(Array.from({ length: nBlasts }, () => new Vector2()));
  const blastProg = uniformArray(new Array(nBlasts).fill(0));
  const blastCount = uniform(0);

  // Accumulate a refraction offset from every active ripple (matches the GLSL
  // version: one expanding push-out/pull-in lobe per blast, fading with age).
  const rippleOffset = Fn(() => {
    const baseUv = uv();
    const offset = vec2(0, 0).toVar();
    const lat = baseUv.y.sub(0.5).mul(Math.PI);
    const coslat = max(lat.cos(), 0.15); // longitudes compress toward the poles
    Loop(nBlasts, ({ i }) => {
      const active = step(float(i).add(0.5), blastCount); // 1 while i < count
      const c = blastUv.element(i);
      const d = baseUv.sub(c);
      const dx = d.x.sub(d.x.round()); // wrap the longitude seam
      const dd = vec2(dx.mul(2).mul(coslat), d.y); // u spans 2x the degrees of v
      const dist = dd.length();
      const prog = blastProg.element(i);
      const radius = prog.mul(blastMaxR);
      const x = dist.sub(radius).div(blastWidth);
      const x2 = x.mul(x);
      // Narrow push/pull lobe with a quartic exp(-x^4) envelope: the surface snaps
      // back to flat quickly on both sides of the crest instead of trailing off
      // slowly like a Gaussian (exp(-x^2)) would.
      const wave = x.negate().mul(x2.mul(x2).negate().exp());
      const om = prog.oneMinus();
      const fade = om.mul(om);
      const dir = dd.div(max(dist, float(1e-4)));
      offset.addAssign(dir.mul(wave).mul(blastAmp).mul(fade).mul(active));
    });
    return offset;
  });

  const ripUv = uv().add(rippleOffset()).toVar();

  // Shared sun / fresnel / atmosphere nodes (reused by both meshes, as in the
  // example — each material evaluates them in its own geometry context).
  const sunOrientation = normalWorldGeometry.dot(normalize(sunDir)).toVar();
  const viewDirection = positionWorld.sub(cameraPosition).normalize();
  const fresnel = viewDirection.dot(normalWorldGeometry).abs().oneMinus().toVar();
  const atmosphereColor = mix(
    atmTwilightColor,
    atmDayColor,
    sunOrientation.smoothstep(-0.25, 0.75)
  );

  // --- Globe -----------------------------------------------------------------
  const globeMaterial = new MeshStandardNodeMaterial();

  const cloudsStrength = texture(bumpRoughnessCloudsTexture, ripUv).b.smoothstep(0.2, 1);
  globeMaterial.colorNode = mix(texture(dayTexture, ripUv), vec3(1), cloudsStrength.mul(2));

  const roughness = max(
    texture(bumpRoughnessCloudsTexture, ripUv).g,
    step(0.01, cloudsStrength)
  );
  globeMaterial.roughnessNode = roughness.remap(0, 1, roughnessLow, roughnessHigh);

  const night = texture(nightTexture, ripUv);
  const dayStrength = sunOrientation.smoothstep(-0.25, 0.5);
  const atmosphereDayStrength = sunOrientation.smoothstep(-0.5, 1);
  const atmosphereMix = atmosphereDayStrength.mul(fresnel.pow(2)).clamp(0, 1);

  let finalOutput = mix(night.rgb, output.rgb, dayStrength);
  finalOutput = mix(finalOutput, atmosphereColor, atmosphereMix);
  globeMaterial.outputNode = vec4(finalOutput, output.a);

  const bumpElevation = max(texture(bumpRoughnessCloudsTexture, ripUv).r, cloudsStrength);
  globeMaterial.normalNode = bumpMap(bumpElevation);

  // --- Atmosphere shell (back-side) ------------------------------------------
  // Tighter rim than the example's 0.73 floor since our camera sits closer/wider,
  // which would otherwise make the halo read as too thick.
  const atmosphereMaterial = new MeshBasicNodeMaterial({ side: BackSide, transparent: true });
  let alpha = fresnel.remap(0.8, 1, 1, 0).pow(3);
  alpha = alpha.mul(sunOrientation.smoothstep(-0.5, 1));
  atmosphereMaterial.outputNode = vec4(atmosphereColor, alpha);

  return { globeMaterial, atmosphereMaterial, sunDir, blastUv, blastProg, blastCount };
}
