import { getConflicts } from "@/lib/acled";

// Dynamic-by-default (Next 15+ GET route handlers): runs at request time with the runtime
// ACLED service variables. getConflicts() throttles the upstream pull to once per UTC day
// via an in-process memo + Next's fetch cache, so this stays cheap on repeat requests.
export async function GET() {
  try {
    const payload = await getConflicts();
    return Response.json(payload);
  } catch (err) {
    console.error("Unexpected error in /api/conflicts:", err);
    return Response.json({ error: "Failed to load conflict data" }, { status: 500 });
  }
}
