import { NextRequest } from "next/server";
import { proxyBackendJson } from "@/lib/backend-proxy";

type Params = {
  params: Promise<{ pillarType: string }>;
};

export async function POST(_: NextRequest, context: Params) {
  const { pillarType } = await context.params;
  return proxyBackendJson({
    path: `/api/pillar-templates/${encodeURIComponent(pillarType)}/restore`,
    method: "POST",
    mode: "write"
  });
}

