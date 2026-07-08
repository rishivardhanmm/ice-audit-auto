import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { listAuditRuns } from "@/lib/db/database";
import { formatDateTime } from "@/lib/utils";
import { RiskBadge } from "@/components/ui/risk-badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const audits = listAuditRuns(100);

  return (
    <main className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950">
            <ArrowLeft className="size-4" aria-hidden="true" /> Workspace
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-950">Audit History</h1>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white shadow-audit">
        {audits.length === 0 ? (
          <div className="p-8 text-sm text-zinc-500">No audits have been run yet.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {audits.map((audit) => (
              <Link
                href={`/audits/${audit.id}`}
                key={audit.id}
                className="grid gap-4 p-4 transition hover:bg-zinc-50 md:grid-cols-[1fr_120px_120px_180px_44px] md:items-center"
              >
                <div>
                  <div className="font-semibold text-zinc-950">{audit.repository.owner}/{audit.repository.name}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {audit.repository.source === "local" ? audit.repository.localPath : audit.repository.url}
                  </div>
                </div>
                <RiskBadge level={audit.riskLevel} />
                <div className="text-sm font-semibold text-zinc-950">{audit.score}/100</div>
                <div className="text-sm text-zinc-500">{formatDateTime(audit.completedAt ?? audit.startedAt)}</div>
                <FileText className="size-5 text-zinc-500" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
