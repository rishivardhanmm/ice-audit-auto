import type { AuditRun } from "./types";

export const exampleDashboardData: Pick<
  AuditRun,
  "score" | "riskLevel" | "summary" | "stack"
> & {
  severityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
} = {
  score: 67,
  riskLevel: "High",
  stack: {
    languages: ["TypeScript", "JavaScript"],
    frameworks: ["Next.js", "React"],
    packageManagers: ["npm"],
    databases: ["Prisma"],
    cicd: ["GitHub Actions"],
    deployment: ["Vercel"],
    tools: ["ESLint", "Prettier", "Docker"],
    evidence: [
      "package.json includes next and react",
      ".github/workflows/ci.yml exists",
      "vercel.json exists"
    ]
  },
  severityCounts: {
    critical: 0,
    high: 2,
    medium: 4,
    low: 3
  },
  categoryCounts: {
    security: 1,
    dependencies: 2,
    documentation: 2,
    testing: 1,
    deployment: 1,
    maintainability: 2
  },
  summary: {
    clientSummary:
      "The project is usable but carries elevated delivery risk this quarter because dependency hygiene and test coverage need attention.",
    developerSummary:
      "Address high-priority dependency and test gaps first, then tighten deployment documentation and code quality controls.",
    immediateActions: [
      "Resolve high-severity dependency findings",
      "Add a reliable test command for the main application"
    ],
    thisQuarterActions: [
      "Improve setup and deployment documentation",
      "Reduce large source files and TODO/FIXME backlog"
    ],
    laterImprovements: ["Add formatter coverage", "Improve package metadata"]
  }
};
