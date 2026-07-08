import { NextResponse } from "next/server";
import { getAuditRun, saveGeneratedReport } from "@/lib/db/database";
import { buildPdfReport } from "@/lib/reports/pdf-report";

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

  const pdf = await buildPdfReport(audit);
  saveGeneratedReport({
    auditRunId: audit.id,
    format: "pdf"
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${audit.repository.owner}-${audit.repository.name}-audit.pdf"`
    }
  });
}
