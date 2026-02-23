import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ pillarType: string; rubricItemId: string }>;
};

export async function PATCH(request: NextRequest, context: Params) {
  const { pillarType, rubricItemId } = await context.params;
  const body = await request.json();
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}/rubric/${encodeURIComponent(rubricItemId)}`,
    method: "PATCH",
    mode: "write",
    body
  });
}

export async function DELETE(_: NextRequest, context: Params) {
  const { pillarType, rubricItemId } = await context.params;
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}/rubric/${encodeURIComponent(rubricItemId)}`,
    method: "DELETE",
    mode: "write"
  });
}

