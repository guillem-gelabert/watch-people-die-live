import { probeWorldBank } from "@/lib/worldbank";

export async function GET() {
  return Response.json({ worldBank: await probeWorldBank() });
}
