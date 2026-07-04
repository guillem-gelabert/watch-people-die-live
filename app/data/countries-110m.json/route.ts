// Serves the world-atlas TopoJSON at /data/countries-110m.json, matching the old
// Express route. Kept as a route handler (not copied into public/) since it lives in
// node_modules and world-atlas is already a project dependency.

import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "node_modules", "world-atlas", "countries-110m.json");

export async function GET() {
  const body = fs.readFileSync(FILE, "utf8");
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
