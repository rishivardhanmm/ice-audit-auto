"use client";

import { useMemo, useState } from "react";
import { Bot, CheckCircle2, Filter, Search } from "lucide-react";
import type { AuditFinding, AuditCategory, Priority, Severity } from "@/lib/audit/types";
import { formatCategory } from "@/lib/utils";
import { SeverityBadge } from "./ui/risk-badge";

type FilterValue<T extends string> = "all" | T;

export function FindingsTable({ findings }: { findings: AuditFinding[] }) {
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<FilterValue<Severity>>("all");
  const [category, setCategory] = useState<FilterValue<AuditCategory>>("all");
  const [priority, setPriority] = useState<FilterValue<Priority>>("all");
  const [aiFix, setAiFix] = useState<"all" | "yes" | "no">("all");

  const categories = useMemo(
    () => [...new Set(findings.map((finding) => finding.category))].sort(),
    [findings]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return findings.filter((finding) => {
      const matchesQuery =
        !needle ||
        [finding.title, finding.description, finding.evidence, finding.affectedFile ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesSeverity = severity === "all" || finding.severity === severity;
      const matchesCategory = category === "all" || finding.category === category;
      const matchesPriority = priority === "all" || finding.priority === priority;
      const matchesAi =
        aiFix === "all" || (aiFix === "yes" ? finding.canAiFix : !finding.canAiFix);

      return matchesQuery && matchesSeverity && matchesCategory && matchesPriority && matchesAi;
    });
  }, [aiFix, category, findings, priority, query, severity]);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-audit">
      <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Findings</h2>
          <p className="text-sm text-zinc-500">{filtered.length} of {findings.length} shown</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-400" aria-hidden="true" />
            <input
              className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </label>
          <select className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value as FilterValue<Severity>)}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as FilterValue<AuditCategory>)}>
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>{formatCategory(item)}</option>
            ))}
          </select>
          <select className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value as FilterValue<Priority>)}>
            <option value="all">All priorities</option>
            <option value="immediate">Immediate</option>
            <option value="this-quarter">This quarter</option>
            <option value="later">Later</option>
          </select>
          <select className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm" value={aiFix} onChange={(event) => setAiFix(event.target.value as "all" | "yes" | "no")}>
            <option value="all">AI fix status</option>
            <option value="yes">AI-fixable</option>
            <option value="no">Manual only</option>
          </select>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="p-8 text-sm text-zinc-500">No findings were generated for this audit.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {filtered.map((finding) => (
                <tr key={finding.id} className="align-top">
                  <td className="max-w-[280px] px-4 py-4">
                    <div className="font-semibold text-zinc-950">{finding.title}</div>
                    <div className="mt-1 text-zinc-500">{finding.recommendedFix}</div>
                  </td>
                  <td className="px-4 py-4"><SeverityBadge severity={finding.severity} /></td>
                  <td className="px-4 py-4 capitalize text-zinc-700">{formatCategory(finding.category)}</td>
                  <td className="px-4 py-4 text-zinc-700">{finding.priority.replace("-", " ")}</td>
                  <td className="max-w-[360px] px-4 py-4">
                    <div className="text-zinc-700">{finding.evidence}</div>
                    {finding.affectedFile ? <div className="mt-1 font-mono text-xs text-zinc-500">{finding.affectedFile}</div> : null}
                  </td>
                  <td className="px-4 py-4">
                    {finding.canAiFix ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-600">
                        <Bot className="size-3.5" aria-hidden="true" /> No
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="flex items-center gap-2 border-t border-zinc-100 p-6 text-sm text-zinc-500">
              <Filter className="size-4" aria-hidden="true" /> No findings match the current filters.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
