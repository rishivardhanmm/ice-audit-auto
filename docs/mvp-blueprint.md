# Quarterly Project Audit Agent MVP Blueprint

## 1. System Architecture

The MVP is a modular Next.js application with server-side audit APIs and a dashboard UI.

Flow:

1. User enters a GitHub repository URL or selects a local project folder in the dashboard.
2. `POST /api/audits` validates the selected input.
3. The audit job creates an `audit_runs` record with `running` status.
4. The scanner either clones the GitHub repository into `tmp/` with `git clone --depth 1` or reads the selected local folder directly.
5. The file collector ignores build artifacts and dependency folders, then reads bounded text files.
6. The stack detector identifies frameworks, languages, package managers, database tools, CI/CD, and deployment signals.
7. Dependency checks run `npm audit --json --omit=dev` when a package lockfile exists.
8. The rule engine runs the first 20 audit rules against concrete repository evidence.
9. The scoring engine calculates a score out of 100 and a risk level.
10. The summarisation engine uses OpenAI when configured, otherwise it creates deterministic summaries from findings only.
11. Completed runs, findings, stack evidence, and summaries are stored in the database.
12. The UI renders score cards, action buckets, charts, filters, findings, history, and reports.

Production architecture should split the current in-process job into a worker:

- Frontend: Next.js, TypeScript, Tailwind, shadcn/ui-style components.
- API: Next.js route handlers for the MVP, or NestJS/FastAPI if the backend is separated later.
- Database: PostgreSQL.
- Queue: BullMQ, Celery, or Inngest.
- GitHub integration: GitHub App installation tokens.
- AI: OpenAI summarisation constrained to scanner evidence.
- Static analysis: Semgrep, npm audit, pip-audit, eslint, tsc, dependency health tools.
- Reports: HTML template plus PDF export.

## 2. Folder Structure

```text
.
├── src/app
│   ├── api/audits
│   │   ├── route.ts
│   │   └── [id]/report
│   ├── audits/[id]/page.tsx
│   ├── history/page.tsx
│   └── page.tsx
├── src/components
│   ├── audit-console.tsx
│   ├── audit-dashboard.tsx
│   ├── findings-table.tsx
│   └── ui
├── src/lib
│   ├── audit
│   │   ├── rules.ts
│   │   ├── scoring.ts
│   │   ├── stack-detection.ts
│   │   └── summarizer.ts
│   ├── db/database.ts
│   ├── github
│   ├── jobs
│   └── reports
├── docs
├── data
└── tmp
```

## 3. Database Schema

The MVP creates the requested tables locally in SQLite:

- `users`
- `projects`
- `repositories`
- `audit_runs`
- `audit_findings`
- `risk_categories`
- `generated_reports`
- `scheduled_audits`

The production PostgreSQL DDL is in `docs/database-schema.sql`.

Each finding stores:

- `title`
- `description`
- `category`
- `severity`
- `priority`
- `evidence`
- `affected_file`
- `recommended_fix`
- `estimated_effort`
- `business_impact`
- `can_ai_fix`
- `confidence`
- `created_at`

## 4. API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/audits` | List recent audit runs |
| `POST` | `/api/audits` | Run an audit for a GitHub repository URL |
| `GET` | `/api/audits/:id` | Fetch one audit run with findings |
| `GET` | `/api/audits/:id/report` | Generate an HTML report |
| `GET` | `/api/audits/:id/report/pdf` | Generate a PDF report |
| `GET` | `/api/projects/:id/audits` | List audit history for a project |
| `GET` | `/api/local-projects` | List local project folder options |

`POST /api/audits` body:

```json
{
  "source": "github",
  "repositoryUrl": "https://github.com/owner/repo"
}
```

Local audit body:

```json
{
  "source": "local",
  "localPath": "C:\\Projects\\my-app"
}
```

## 5. Background Job Flow

The MVP runs audits synchronously from the API route. The production queue flow should be:

1. API validates repository and creates `audit_runs` with `queued` status.
2. Queue receives `auditRunId`.
3. Worker marks run `running`.
4. Worker obtains a GitHub App installation token for GitHub audits.
5. Worker clones or reads the repository/local folder.
6. Worker runs stack detection, dependency checks, static analysis, and custom rules.
7. Worker stores findings as they are produced.
8. Worker calculates score and summaries.
9. Worker generates HTML/PDF reports.
10. Worker marks run `completed` or `failed`.
11. Scheduler advances `scheduled_audits.next_run_at` by three months.
12. Future email job sends approved reports to teams or clients.

## 6. UI Pages

| Page | Purpose |
| --- | --- |
| `/` | Audit workspace with repository input, current dashboard, and recent history |
| `/history` | Full audit history list |
| `/audits/:id` | Permanent detail page for one audit |
| `/api/audits/:id/report` | Printable HTML report |
| `/api/audits/:id/report/pdf` | PDF report download |

## 7. Audit Scoring Logic

Severity weights:

| Severity | Penalty |
| --- | ---: |
| Critical | 25 |
| High | 14 |
| Medium | 7 |
| Low | 3 |

Score:

```text
score = max(0, 100 - sum(severity penalties))
```

Risk level:

- Critical: any critical finding or score below 50.
- High: any high finding or score below 70.
- Medium: any medium finding or score below 86.
- Low: no medium-or-higher findings and score at least 86.

Priority:

- Critical and High: immediate.
- Medium: this-quarter.
- Low: later.

## 8. First 20 Audit Rules

| ID | Rule | Category | Default Severity |
| --- | --- | --- | --- |
| `SEC001_SECRET_PATTERN_DETECTED` | Potential secret committed to the repository | security | critical |
| `SEC002_COMMITTED_ENV_FILE` | Runtime environment file is committed | security | critical |
| `DOC001_MISSING_ENV_EXAMPLE` | Missing `.env.example` for required configuration | documentation | high |
| `DOC002_MISSING_README` | README is missing | documentation | high |
| `DOC003_WEAK_README_SETUP` | README lacks setup and operating guidance | documentation | medium |
| `TEST001_MISSING_TEST_COVERAGE_SIGNAL` | No tests detected | testing | high |
| `TEST002_MISSING_TEST_COMMAND` | No reliable test command | testing | high |
| `BUILD001_MISSING_BUILD_COMMAND` | Build command is missing | build | high |
| `DEP001_NPM_AUDIT_VULNERABILITY` | npm audit vulnerability | dependencies | high |
| `DEP002_UNPINNED_PACKAGE_VERSIONS` | Dependency versions are not pinned | dependencies | medium |
| `DEP003_MISSING_LOCKFILE` | Package lockfile is missing | dependencies | medium |
| `MAINT001_MISSING_LINTING` | Linting is not configured | maintainability | medium |
| `MAINT002_MISSING_FORMATTER` | Formatting is not configured | maintainability | low |
| `MAINT003_LARGE_SOURCE_FILES` | Large source files increase maintenance risk | maintainability | medium |
| `MAINT004_TODO_FIXME_DEBT` | TODO/FIXME technical debt is present | maintainability | low |
| `CICD001_MISSING_PIPELINE` | CI/CD pipeline is missing | ci_cd | high |
| `DEPLOY001_MISSING_DEPLOYMENT_GUIDANCE` | Deployment instructions or configuration are missing | deployment | medium |
| `LIC001_MISSING_LICENSE` | License is missing | licensing | medium |
| `OBS001_MISSING_OBSERVABILITY_SIGNAL` | Monitoring and logging signals are weak | observability | medium |
| `MAINT005_TYPESCRIPT_STRICT_DISABLED` | TypeScript strictness is not enabled | maintainability | medium |

## 9. Example Dashboard Data

The app includes example dashboard data in `src/lib/audit/example-data.ts`:

```json
{
  "score": 67,
  "riskLevel": "High",
  "severityCounts": {
    "critical": 0,
    "high": 2,
    "medium": 4,
    "low": 3
  },
  "categoryCounts": {
    "security": 1,
    "dependencies": 2,
    "documentation": 2,
    "testing": 1,
    "deployment": 1,
    "maintainability": 2
  }
}
```

## 10. Step-by-Step Implementation Plan

Phase 1, MVP foundation:

1. Create Next.js app shell, TypeScript config, Tailwind styling.
2. Create data types for repositories, runs, findings, scoring, stack profile, and summaries.
3. Implement local persistence with the target table model.
4. Implement GitHub URL validation and safe clone flow.
5. Implement bounded file collection with ignored directories and size limits.

Phase 2, audit engine:

1. Add stack detection for JS/TS, Python, Java, .NET, Docker, CI/CD, deployment, and database usage.
2. Add npm audit ingestion when a lockfile exists.
3. Implement the first 20 audit rules.
4. Add score and risk-level logic.
5. Add evidence-only summarisation with OpenAI fallback behavior.

Phase 3, product surface:

1. Build repository onboarding form.
2. Build dashboard score, risk badges, category charts, and action buckets.
3. Build filterable findings table.
4. Build audit history and audit detail pages.
5. Build HTML and PDF report endpoints.

Phase 4, production hardening:

1. Replace synchronous route execution with a queue and worker.
2. Replace local SQLite with PostgreSQL.
3. Add GitHub App installation flow.
4. Add auth with NextAuth or Clerk.
5. Add Semgrep, pip-audit, language-specific build/test checks, and dependency health checks.
6. Add scheduler, email delivery, branded report templates, and guarded AI PR creation.

## 11. MVP Code Map

Core implementation files:

- `src/lib/jobs/audit-job.ts`
- `src/lib/github/repository.ts`
- `src/lib/audit/stack-detection.ts`
- `src/lib/audit/rules.ts`
- `src/lib/audit/scoring.ts`
- `src/lib/audit/summarizer.ts`
- `src/lib/db/database.ts`
- `src/lib/reports/html-report.ts`
- `src/lib/reports/pdf-report.ts`
- `src/app/api/audits/route.ts`
- `src/components/audit-console.tsx`
- `src/components/audit-dashboard.tsx`
- `src/components/findings-table.tsx`

## AI Pull Request Feature Design

Future PR automation must use the guardrails in `src/lib/github/ai-pull-request-policy.ts`:

1. Select only findings with `can_ai_fix = true` and non-low confidence.
2. Create a new branch.
3. Modify only files referenced by the audit finding evidence.
4. Run tests and linting.
5. Generate a PR title and body with the finding, evidence, changes, tests, and risk level.
6. Ask for human approval before merge.
7. Never push directly to main.
8. Never change secrets, production credentials, database migrations, payment code, authentication logic, or business-critical logic without explicit human approval.
