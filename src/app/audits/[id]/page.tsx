import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuditDashboard } from "@/components/audit-dashboard";
import { getAuditRun } from "@/lib/db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = getAuditRun(id);

  if (!audit) {
    notFound();
  }

  return (
    <main className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
        <ArrowLeft className="size-4" aria-hidden="true" /> Workspace
      </Link>
      <AuditDashboard audit={audit} />
    </main>
  );
}
