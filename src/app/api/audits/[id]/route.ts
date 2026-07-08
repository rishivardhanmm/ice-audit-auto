import { NextResponse } from "next/server";
import { getAuditRun } from "@/lib/db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const audit = getAuditRun(id);

  if (!audit) {
    return NextResponse.json({ error: "Audit run not found" }, { status: 404 });
  }

  return NextResponse.json({ audit });
}
