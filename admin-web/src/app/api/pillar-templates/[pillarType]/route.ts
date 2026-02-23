import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ pillarType: string }>;
};

export async function GET(request: NextRequest, context: Params) {
  const { pillarType } = await context.params;
  const query = request.nextUrl.search || "";
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}`,
    method: "GET",
    mode: "read",
    query
  });
}

export async function PATCH(request: NextRequest, context: Params) {
  const { pillarType } = await context.params;
  const body = await request.json();
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}`,
    method: "PATCH",
    mode: "write",
    body
  });
}

export async function DELETE(_: NextRequest, context: Params) {
  const { pillarType } = await context.params;
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}`,
    method: "DELETE",
    mode: "write"
  });
}

