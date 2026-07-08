import { NextResponse } from "next/server";
import { listProjectAuditRuns } from "@/lib/db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({
    audits: listProjectAuditRuns(id)
  });
}
