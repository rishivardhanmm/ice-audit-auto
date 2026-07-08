# Quarterly Project Audit Agent

Full-stack MVP for auditing GitHub repositories every quarter and producing a scored technical risk dashboard.

## What Is Included

- Next.js, TypeScript, Tailwind dashboard
- API routes for audit runs, audit history, HTML reports, and PDF reports
- Safe GitHub URL parsing and clone flow for GitHub repositories
- Local project folder auditing from the same machine
- Stack detection for common web, backend, database, CI/CD, and deployment signals
- First 20 audit rules covering security, dependencies, docs, tests, build, CI/CD, deployment, licensing, observability, and maintainability
- Evidence-only AI summarisation with deterministic fallback when `OPENAI_API_KEY` is not configured
- Local SQLite persistence for the MVP
- PostgreSQL production schema in [docs/database-schema.sql](./docs/database-schema.sql)
- Detailed system blueprint in [docs/mvp-blueprint.md](./docs/mvp-blueprint.md)

## Quick Start

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3000 and enter a public GitHub repository URL.

## Environment

Copy `.env.example` to `.env.local` and set values as needed:

```bash
GITHUB_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4.1-mini
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_BASE_URL=
AZURE_OPENAI_DEPLOYMENT=
AZURE_AI_PROJECT_ENDPOINT=
AUDIT_DB_PATH=./data/audit-agent.db
```

`GITHUB_TOKEN` is optional for public repositories. For production, replace it with a GitHub App installation-token flow.
For Azure OpenAI, set `AZURE_OPENAI_BASE_URL` to the `/openai/v1` endpoint and `AZURE_OPENAI_DEPLOYMENT` to the deployment name, such as `gpt-4o-mini`.

## Verification

```bash
npm run typecheck
npm run build
```

The local MVP uses SQLite so it can run without Docker or PostgreSQL. The production design uses PostgreSQL with the schema in `docs/database-schema.sql`.
"# ice-audit-auto" 
