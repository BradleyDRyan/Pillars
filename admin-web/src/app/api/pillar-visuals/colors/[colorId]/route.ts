import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ colorId: string }>;
};

export async function PATCH(request: NextRequest, context: Params) {
  const { colorId } = await context.params;
  const body = await request.json();
  return proxyBackendJson({
    path: `/api/pillar-visuals/colors/${encodeURIComponent(colorId)}`,
    method: "PATCH",
    mode: "write",
    body
  });
}

export async function DELETE(_: NextRequest, context: Params) {
  const { colorId } = await context.params;
  return proxyBackendJson({
    path: `/api/pillar-visuals/colors/${encodeURIComponent(colorId)}`,
    method: "DELETE",
    mode: "write"
  });
}
