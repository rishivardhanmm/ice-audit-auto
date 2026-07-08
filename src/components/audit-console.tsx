"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, FolderOpen, Github, Loader2, Play, RotateCw } from "lucide-react";
import type { AuditRun } from "@/lib/audit/types";
import { formatDateTime } from "@/lib/utils";
import { AuditDashboard } from "./audit-dashboard";
import { RiskBadge } from "./ui/risk-badge";

type LocalProjectOption = {
  name: string;
  path: string;
  displayPath: string;
  hints: string[];
};

export function AuditConsole({ initialAudits }: { initialAudits: AuditRun[] }) {
  const [source, setSource] = useState<"github" | "local">("github");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [localProjects, setLocalProjects] = useState<LocalProjectOption[]>([]);
  const [isLoadingLocalProjects, setIsLoadingLocalProjects] = useState(false);
  const [audits, setAudits] = useState(initialAudits);
  const [selectedAuditId, setSelectedAuditId] = useState(initialAudits[0]?.id);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const selectedAudit = useMemo(
    () => audits.find((audit) => audit.id === selectedAuditId) ?? audits[0],
    [audits, selectedAuditId]
  );

  useEffect(() => {
    if (source !== "local" || localProjects.length > 0 || isLoadingLocalProjects) {
      return;
    }

    setIsLoadingLocalProjects(true);
    fetch("/api/local-projects")
      .then((response) => response.json())
      .then((payload: { projects?: LocalProjectOption[] }) => {
        setLocalProjects(payload.projects ?? []);
      })
      .catch(() => {
        setLocalProjects([]);
      })
      .finally(() => {
        setIsLoadingLocalProjects(false);
      });
  }, [isLoadingLocalProjects, localProjects.length, source]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsRunning(true);

    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(
          source === "github"
            ? { source, repositoryUrl }
            : { source, localPath }
        )
      });
      const payload = (await response.json()) as { audit?: AuditRun; error?: string };

      if (!response.ok || !payload.audit) {
        throw new Error(payload.error ?? "Audit failed");
      }

      setAudits((current) => [payload.audit as AuditRun, ...current.filter((audit) => audit.id !== payload.audit?.id)]);
      setSelectedAuditId(payload.audit.id);
      if (source === "github") {
        setRepositoryUrl("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audit failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <aside className="space-y-5">
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-audit">
          <div className="flex items-center gap-2">
            <span className="inline-grid size-9 place-items-center rounded-md bg-zinc-950 text-white">
              <Github className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-zinc-950">Quarterly Project Audit Agent</h1>
              <p className="text-sm text-zinc-500">Repository audit workspace</p>
            </div>
          </div>

          <form className="mt-5 space-y-3" onSubmit={submit}>
            <div className="grid grid-cols-2 rounded-md border border-zinc-200 bg-zinc-50 p-1">
              <button
                className={`inline-flex h-9 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition ${
                  source === "github" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
                type="button"
                onClick={() => setSource("github")}
                disabled={isRunning}
              >
                <Github className="size-4" aria-hidden="true" /> GitHub
              </button>
              <button
                className={`inline-flex h-9 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition ${
                  source === "local" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
                }`}
                type="button"
                onClick={() => setSource("local")}
                disabled={isRunning}
              >
                <FolderOpen className="size-4" aria-hidden="true" /> Local
              </button>
            </div>

            {source === "github" ? (
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">GitHub repository URL</span>
                <input
                  className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                  type="url"
                  value={repositoryUrl}
                  onChange={(event) => setRepositoryUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                  disabled={isRunning}
                  required
                />
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Select local project</span>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    value={localPath}
                    onChange={(event) => setLocalPath(event.target.value)}
                    disabled={isRunning || isLoadingLocalProjects}
                  >
                    <option value="">{isLoadingLocalProjects ? "Loading local folders..." : "Choose a folder"}</option>
                    {localProjects.map((project) => (
                      <option key={project.path} value={project.path}>
                        {project.name} - {project.displayPath}{project.hints.length ? ` (${project.hints.join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">Or enter full path</span>
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    type="text"
                    value={localPath}
                    onChange={(event) => setLocalPath(event.target.value)}
                    placeholder="C:\\Projects\\my-app"
                    disabled={isRunning}
                    required
                  />
                </label>
              </div>
            )}
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              type="submit"
              disabled={isRunning}
            >
              {isRunning ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {isRunning ? "Running audit" : "Start audit"}
            </button>
            {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          </form>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white shadow-audit">
          <div className="flex items-center justify-between border-b border-zinc-200 p-4">
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-zinc-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-zinc-950">Audit History</h2>
            </div>
            <a href="/history" className="text-sm font-semibold text-zinc-700 hover:text-zinc-950">Open</a>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {audits.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">No audits yet.</div>
            ) : (
              audits.map((audit) => (
                <button
                  key={audit.id}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                    audit.id === selectedAudit?.id
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                  type="button"
                  onClick={() => setSelectedAuditId(audit.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-950">
                        {audit.repository.owner}/{audit.repository.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{formatDateTime(audit.completedAt ?? audit.startedAt)}</div>
                    </div>
                    <RiskBadge level={audit.riskLevel} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>{audit.findings.length} findings</span>
                    <span className="font-semibold text-zinc-900">{audit.score}/100</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </aside>

      <main>
        {isRunning ? (
          <section className="grid min-h-[560px] place-items-center rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-audit">
            <div>
              <Loader2 className="mx-auto size-10 animate-spin text-zinc-900" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold text-zinc-950">Scanning repository</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Cloning, detecting stack signals, running audit rules, scoring risk, and generating the summary.
              </p>
            </div>
          </section>
        ) : selectedAudit ? (
          <AuditDashboard audit={selectedAudit} />
        ) : (
          <section className="grid min-h-[560px] place-items-center rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
            <div>
              <RotateCw className="mx-auto size-10 text-zinc-400" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold text-zinc-950">Ready for the first audit</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Enter a GitHub repository URL to generate a scored technical audit.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
