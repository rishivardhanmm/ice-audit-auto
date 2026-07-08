import { AuditConsole } from "@/components/audit-console";
import { listAuditRuns } from "@/lib/db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function HomePage() {
  const audits = listAuditRuns(25);

  return <AuditConsole initialAudits={audits} />;
}
