import { NextResponse } from "next/server";
import { getAuditRun, saveGeneratedReport } from "@/lib/db/database";
import { buildHtmlReport } from "@/lib/reports/html-report";

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

  const html = buildHtmlReport(audit);
  saveGeneratedReport({
    auditRunId: audit.id,
    format: "html",
    htmlContent: html
  });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}
