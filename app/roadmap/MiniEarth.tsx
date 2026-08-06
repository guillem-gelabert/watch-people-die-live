"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

interface MiniEarthProps {
  size?: number;
}

// The 22px globe in the "back to the globe" control. A real orthographic render of the land
// rather than a CSS gradient disc: at this size the continents are the only thing that says
// "globe" instead of "blue dot", and the design draws them for exactly that reason.
export default function MiniEarth({ size = 22 }: MiniEarthProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const res = await fetch("/data/countries-110m.json");
      if (!res.ok) return;
      const topo = await res.json();
      if (cancelled || !ref.current) return;

      const land = topojson.feature(
        topo,
        topo.objects.land ?? topo.objects.countries,
      ) as unknown as d3.GeoPermissibleObjects;

      // Capped at 2: past that the extra pixels cost memory on phones and buy nothing at 22px.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const projection = d3
        .geoOrthographic()
        .rotate([-12, -22])
        .fitExtent(
          [
            [0.5, 0.5],
            [size - 0.5, size - 0.5],
          ],
          { type: "Sphere" },
        );
      const path = d3.geoPath(projection, ctx);

      // Lit from the upper left, so the sphere reads as a sphere and not a flat circle.
      const glow = ctx.createRadialGradient(
        size * 0.34,
        size * 0.28,
        size * 0.04,
        size * 0.5,
        size * 0.5,
        size * 0.66,
      );
      glow.addColorStop(0, "#3a7cb4");
      glow.addColorStop(1, "#0b2540");

      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      path(land);
      ctx.fillStyle = "#8fae86";
      ctx.fill();

      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(255,255,255,.4)";
      ctx.stroke();
    })();

    return () => {
      cancelled = true;
    };
  }, [size]);

  return <canvas id="story-return-disc" ref={ref} aria-hidden="true" />;
}
