import { after } from "next/server";
import { getConflicts, refreshConflicts } from "@/lib/acled";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { payload, needsRefresh } = await getConflicts();
    if (needsRefresh) after(refreshConflicts);
    return Response.json(payload, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("Unexpected error in /api/conflicts:", err);
    return Response.json({ error: "Failed to load conflict data" }, { status: 500 });
  }
}
