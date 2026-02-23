import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ iconId: string }>;
};

export async function PATCH(request: NextRequest, context: Params) {
  const { iconId } = await context.params;
  const body = await request.json();
  return proxyBackendJson({
    path: `/api/pillar-visuals/icons/${encodeURIComponent(iconId)}`,
    method: "PATCH",
    mode: "write",
    body
  });
}

export async function DELETE(_: NextRequest, context: Params) {
  const { iconId } = await context.params;
  return proxyBackendJson({
    path: `/api/pillar-visuals/icons/${encodeURIComponent(iconId)}`,
    method: "DELETE",
    mode: "write"
  });
}
