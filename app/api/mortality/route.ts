import { getMortality } from "@/lib/worldbank";

export async function GET() {
  try {
    const payload = await getMortality();
    return Response.json(payload);
  } catch (err) {
    console.error("Unexpected error in /api/mortality:", err);
    return Response.json({ error: "Failed to load mortality data" }, { status: 500 });
  }
}
