import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Pillars Admin", charset="UTF-8"'
    }
  });
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.ADMIN_PANEL_USER?.trim();
  const expectedPassword = process.env.ADMIN_PANEL_PASSWORD?.trim();

  // Auth is optional in local dev until credentials are configured.
  if (!expectedUser || !expectedPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encodedCredentials = authHeader.slice("Basic ".length).trim();
  let decodedCredentials = "";

  try {
    decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf8");
  } catch {
    return unauthorizedResponse();
  }

  const separatorIndex = decodedCredentials.indexOf(":");
  if (separatorIndex < 0) {
    return unauthorizedResponse();
  }

  const user = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);
  if (user !== expectedUser || password !== expectedPassword) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/schemas/:path*", "/api/agent-runner"]
};
