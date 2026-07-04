import { headers } from "next/headers";
import { clientIpFromHeaders, geolocate } from "@/lib/geo";

export async function GET() {
  const hdrs = await headers();
  const payload = await geolocate(clientIpFromHeaders(hdrs));
  return Response.json(payload);
}
