import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.search || "";
  return proxyBackendJson({
    path: "/api/pillar-visuals",
    method: "GET",
    mode: "read",
    query
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  return proxyBackendJson({
    path: "/api/pillar-visuals",
    method: "PUT",
    mode: "write",
    body
  });
}
