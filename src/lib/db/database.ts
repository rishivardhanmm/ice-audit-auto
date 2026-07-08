import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  AuditFinding,
  AuditFindingInput,
  AuditRun,
  AuditSummary,
  RepositoryInfo,
  RiskLevel,
  StackProfile
} from "@/lib/audit/types";

type DatabaseHandle = Database.Database;

type AuditRunRow = {
  id: string;
  project_id: string;
  repository_id: string;
  status: AuditRun["status"];
  score: number;
  risk_level: RiskLevel;
  started_at: string;
  completed_at: string | null;
  error: string | null;
  stack_json: string;
  summary_json: string;
  provider: RepositoryInfo["source"];
  owner: string;
  repo_name: string;
  repo_url: string;
  clone_url: string;
  default_branch: string | null;
};

type AuditFindingRow = {
  id: string;
  audit_run_id: string;
  rule_id: string;
  title: string;
  description: string;
  category: AuditFinding["category"];
  severity: AuditFinding["severity"];
  priority: AuditFinding["priority"];
  evidence: string;
  affected_file: string | null;
  recommended_fix: string;
  estimated_effort: AuditFinding["estimatedEffort"];
  business_impact: string;
  can_ai_fix: 0 | 1;
  confidence: AuditFinding["confidence"];
  created_at: string;
};

let db: DatabaseHandle | undefined;

export function getDb(): DatabaseHandle {
  if (db) {
    return db;
  }

  const configuredPath = process.env.AUDIT_DB_PATH ?? "./data/audit-agent.db";
  const dbPath = path.resolve(process.cwd(), configuredPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  return db;
}

export function createRunningAuditRun(repository: RepositoryInfo): {
  auditRunId: string;
  projectId: string;
  repositoryId: string;
} {
  const database = getDb();
  const now = new Date().toISOString();
  const projectName = `${repository.owner}/${repository.name}`;
  const projectId = crypto.randomUUID();
  const repositoryId = crypto.randomUUID();
  const auditRunId = crypto.randomUUID();

  const transaction = database.transaction(() => {
    const existingRepository = database
      .prepare(
        "SELECT repositories.id AS repository_id, projects.id AS project_id FROM repositories JOIN projects ON projects.id = repositories.project_id WHERE repositories.url = ?"
      )
      .get(repository.url) as { repository_id: string; project_id: string } | undefined;

    const resolvedProjectId = existingRepository?.project_id ?? projectId;
    const resolvedRepositoryId = existingRepository?.repository_id ?? repositoryId;

    if (!existingRepository) {
      database
        .prepare(
          "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
        )
        .run(resolvedProjectId, projectName, now, now);

      database
        .prepare(
          "INSERT INTO repositories (id, project_id, provider, owner, name, url, clone_url, default_branch, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          resolvedRepositoryId,
          resolvedProjectId,
          repository.source,
          repository.owner,
          repository.name,
          repository.url,
          repository.cloneUrl,
          repository.defaultBranch ?? null,
          now
        );
    } else {
      database.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, resolvedProjectId);
    }

    database
      .prepare(
        "INSERT INTO audit_runs (id, project_id, repository_id, status, score, risk_level, started_at, stack_json, summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        auditRunId,
        resolvedProjectId,
        resolvedRepositoryId,
        "running",
        0,
        "Low",
        now,
        "{}",
        "{}",
        now
      );

    return {
      auditRunId,
      projectId: resolvedProjectId,
      repositoryId: resolvedRepositoryId
    };
  });

  return transaction();
}

export function completeAuditRun(input: {
  auditRunId: string;
  score: number;
  riskLevel: RiskLevel;
  stack: StackProfile;
  summary: AuditSummary;
  findings: AuditFindingInput[];
}): AuditRun {
  const database = getDb();
  const now = new Date().toISOString();

  const transaction = database.transaction(() => {
    database
      .prepare(
        "UPDATE audit_runs SET status = ?, score = ?, risk_level = ?, completed_at = ?, stack_json = ?, summary_json = ? WHERE id = ?"
      )
      .run(
        "completed",
        input.score,
        input.riskLevel,
        now,
        JSON.stringify(input.stack),
        JSON.stringify(input.summary),
        input.auditRunId
      );

    const statement = database.prepare(
      "INSERT INTO audit_findings (id, audit_run_id, rule_id, title, description, category, severity, priority, evidence, affected_file, recommended_fix, estimated_effort, business_impact, can_ai_fix, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    for (const finding of input.findings) {
      statement.run(
        crypto.randomUUID(),
        input.auditRunId,
        finding.ruleId,
        finding.title,
        finding.description,
        finding.category,
        finding.severity,
        finding.priority,
        finding.evidence,
        finding.affectedFile ?? null,
        finding.recommendedFix,
        finding.estimatedEffort,
        finding.businessImpact,
        finding.canAiFix ? 1 : 0,
        finding.confidence,
        now
      );
    }
  });

  transaction();
  const run = getAuditRun(input.auditRunId);
  if (!run) {
    throw new Error("Audit run was completed but could not be loaded.");
  }

  return run;
}

export function failAuditRun(auditRunId: string, error: string): AuditRun | undefined {
  const database = getDb();
  const now = new Date().toISOString();

  database
    .prepare("UPDATE audit_runs SET status = ?, completed_at = ?, error = ? WHERE id = ?")
    .run("failed", now, error, auditRunId);

  return getAuditRun(auditRunId);
}

export function listAuditRuns(limit = 25): AuditRun[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT audit_runs.*, repositories.owner, repositories.name AS repo_name, repositories.url AS repo_url,
              repositories.clone_url, repositories.default_branch, repositories.provider
         FROM audit_runs
         JOIN repositories ON repositories.id = audit_runs.repository_id
        ORDER BY audit_runs.started_at DESC
        LIMIT ?`
    )
    .all(limit) as AuditRunRow[];

  return rows.map(hydrateAuditRun);
}

export function listProjectAuditRuns(projectId: string): AuditRun[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT audit_runs.*, repositories.owner, repositories.name AS repo_name, repositories.url AS repo_url,
              repositories.clone_url, repositories.default_branch, repositories.provider
         FROM audit_runs
         JOIN repositories ON repositories.id = audit_runs.repository_id
        WHERE audit_runs.project_id = ?
        ORDER BY audit_runs.started_at DESC`
    )
    .all(projectId) as AuditRunRow[];

  return rows.map(hydrateAuditRun);
}

export function getAuditRun(id: string): AuditRun | undefined {
  const database = getDb();
  const row = database
    .prepare(
      `SELECT audit_runs.*, repositories.owner, repositories.name AS repo_name, repositories.url AS repo_url,
              repositories.clone_url, repositories.default_branch, repositories.provider
         FROM audit_runs
         JOIN repositories ON repositories.id = audit_runs.repository_id
        WHERE audit_runs.id = ?`
    )
    .get(id) as AuditRunRow | undefined;

  if (!row) {
    return undefined;
  }

  return hydrateAuditRun(row);
}

export function saveGeneratedReport(input: {
  auditRunId: string;
  format: "html" | "pdf";
  htmlContent?: string;
  storagePath?: string;
}): string {
  const database = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  database
    .prepare(
      "INSERT INTO generated_reports (id, audit_run_id, format, storage_path, html_content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(id, input.auditRunId, input.format, input.storagePath ?? null, input.htmlContent ?? null, now);

  return id;
}

function hydrateAuditRun(row: AuditRunRow): AuditRun {
  return {
    id: row.id,
    projectId: row.project_id,
    repositoryId: row.repository_id,
    repository: {
      source: row.provider,
      owner: row.owner,
      name: row.repo_name,
      url: row.repo_url,
      cloneUrl: row.clone_url,
      localPath: row.provider === "local" ? row.clone_url : undefined,
      defaultBranch: row.default_branch ?? undefined
    },
    status: row.status,
    score: row.score,
    riskLevel: row.risk_level,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    stack: parseJson(row.stack_json, emptyStack()),
    summary: parseJson(row.summary_json, emptySummary()),
    findings: listFindingsForRun(row.id)
  };
}

function listFindingsForRun(auditRunId: string): AuditFinding[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM audit_findings WHERE audit_run_id = ? ORDER BY created_at ASC")
    .all(auditRunId) as AuditFindingRow[];

  return rows.map((row) => ({
    id: row.id,
    auditRunId: row.audit_run_id,
    ruleId: row.rule_id,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    priority: row.priority,
    evidence: row.evidence,
    affectedFile: row.affected_file ?? undefined,
    recommendedFix: row.recommended_fix,
    estimatedEffort: row.estimated_effort,
    businessImpact: row.business_impact,
    canAiFix: Boolean(row.can_ai_fix),
    confidence: row.confidence,
    createdAt: row.created_at
  }));
}

function ensureSchema(database: DatabaseHandle): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      client_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      clone_url TEXT NOT NULL,
      default_branch TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      risk_level TEXT NOT NULL DEFAULT 'Low',
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT,
      stack_json TEXT NOT NULL DEFAULT '{}',
      summary_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      severity_weight INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_findings (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      priority TEXT NOT NULL,
      evidence TEXT NOT NULL,
      affected_file TEXT,
      recommended_fix TEXT NOT NULL,
      estimated_effort TEXT NOT NULL,
      business_impact TEXT NOT NULL,
      can_ai_fix INTEGER NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
      format TEXT NOT NULL,
      storage_path TEXT,
      html_content TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_audits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      cadence TEXT NOT NULL DEFAULT 'quarterly',
      cron_expression TEXT,
      next_run_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_runs_project_started ON audit_runs(project_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_findings_run ON audit_findings(audit_run_id);
    CREATE INDEX IF NOT EXISTS idx_audit_findings_severity ON audit_findings(severity);
  `);

  seedRiskCategories(database);
}

function seedRiskCategories(database: DatabaseHandle): void {
  const now = new Date().toISOString();
  const rows = [
    ["security", "Secrets, vulnerable auth flows, and OWASP-style application security risk.", 25],
    ["dependencies", "Known vulnerabilities, package health, lockfile, and versioning risk.", 14],
    ["documentation", "README, setup, configuration, and handover readiness.", 7],
    ["testing", "Automated test coverage and repeatable verification.", 14],
    ["build", "Build reproducibility and production artifact risk.", 14],
    ["maintainability", "Complexity, code quality, type safety, and technical debt.", 7],
    ["deployment", "Release, runtime configuration, and operating guidance.", 7],
    ["ci_cd", "Automated quality gates and delivery pipeline evidence.", 14],
    ["licensing", "License clarity and compliance metadata.", 7],
    ["observability", "Logging, monitoring, telemetry, and production support signals.", 7],
    ["client", "Client-facing risk that affects trust, handover, or explainability.", 7]
  ];

  const statement = database.prepare(
    "INSERT OR IGNORE INTO risk_categories (id, name, description, severity_weight, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  for (const [name, description, weight] of rows) {
    statement.run(crypto.randomUUID(), name, description, weight, now);
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function emptyStack(): StackProfile {
  return {
    languages: [],
    frameworks: [],
    packageManagers: [],
    databases: [],
    cicd: [],
    deployment: [],
    tools: [],
    evidence: []
  };
}

function emptySummary(): AuditSummary {
  return {
    clientSummary: "",
    developerSummary: "",
    immediateActions: [],
    thisQuarterActions: [],
    laterImprovements: []
  };
}
