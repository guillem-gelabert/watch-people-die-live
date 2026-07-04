import { Vector3 } from "three/webgpu";

// Direction to the sun, as a unit vector in the same frame as the earth texture: it
// points at the subsolar point (where the sun is overhead right now). The subsolar
// longitude tracks UTC (15°/hour); latitude is the solar declination for the day of
// year. Equation-of-time is omitted (<= ~4deg / 16 min error) — plenty for a
// day/night mask.
export function sunDirectionNow(out: Vector3): Vector3 {
  const now = new Date();
  const hours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = -15 * (hours - 12);
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - yearStart) / 86400000);
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  return out.copy(lonLatToVec3(lon, decl, 1)).normalize();
}

// Exponential inter-arrival time for a Poisson process with the given mean.
export function expGap(mean: number): number {
  return -Math.log(1 - Math.random()) * mean;
}

// Atomic "double flash" brightness over the flash lifetime (age in ms).
export function flashIntensity(age: number): number {
  const bump = (a: number, peak: number, riseW: number, fallW: number) => {
    const x = (a - peak) / (a < peak ? riseW : fallW);
    return Math.exp(-x * x);
  };
  const first = bump(age, 12, 9, 26);
  const second = bump(age, 460, 190, 720);
  return Math.min(first * 1.0 + second * 0.8, 1.0);
}

// lon/lat (degrees) -> point on a sphere textured with a standard equirectangular
// map (north up, lon -180 at the left seam).
export function lonLatToVec3(lon: number, lat: number, r: number): Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}
