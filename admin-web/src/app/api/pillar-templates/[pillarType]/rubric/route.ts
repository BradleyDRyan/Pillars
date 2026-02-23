import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ pillarType: string }>;
};

export async function POST(request: NextRequest, context: Params) {
  const { pillarType } = await context.params;
  const body = await request.json();
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}/rubric`,
    method: "POST",
    mode: "write",
    body
  });
}

