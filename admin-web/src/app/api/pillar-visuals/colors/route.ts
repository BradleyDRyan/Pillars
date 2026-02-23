import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function POST(request: NextRequest) {
  const body = await request.json();
  return proxyBackendJson({
    path: "/api/pillar-visuals/colors",
    method: "POST",
    mode: "write",
    body
  });
}
