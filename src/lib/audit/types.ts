export type Severity = "critical" | "high" | "medium" | "low";

export type Priority = "immediate" | "this-quarter" | "later";

export type RiskLevel = "Critical" | "High" | "Medium" | "Low";

export type AuditCategory =
  | "security"
  | "dependencies"
  | "documentation"
  | "testing"
  | "build"
  | "maintainability"
  | "deployment"
  | "ci_cd"
  | "licensing"
  | "observability"
  | "client";

export type Confidence = "high" | "medium" | "low";

export type Effort = "S" | "M" | "L";

export type RepositoryInfo = {
  source: "github" | "local";
  owner: string;
  name: string;
  defaultBranch?: string;
  url: string;
  cloneUrl: string;
  localPath?: string;
};

export type RepositoryFile = {
  path: string;
  absolutePath: string;
  sizeBytes: number;
  extension: string;
  isText: boolean;
  lineCount: number;
  content?: string;
};

export type PackageJson = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  license?: string;
  private?: boolean;
};

export type StackProfile = {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  databases: string[];
  cicd: string[];
  deployment: string[];
  tools: string[];
  evidence: string[];
};

export type NpmAuditIssue = {
  packageName: string;
  severity: Severity;
  title: string;
  via: string[];
  range?: string;
  fixAvailable?: boolean;
};

export type AuditContext = {
  repository: RepositoryInfo;
  rootPath: string;
  files: RepositoryFile[];
  stack: StackProfile;
  packageJson?: PackageJson;
  npmAuditIssues: NpmAuditIssue[];
  scannedAt: string;
};

export type AuditFindingInput = {
  ruleId: string;
  title: string;
  description: string;
  category: AuditCategory;
  severity: Severity;
  priority: Priority;
  evidence: string;
  affectedFile?: string;
  recommendedFix: string;
  estimatedEffort: Effort;
  businessImpact: string;
  canAiFix: boolean;
  confidence: Confidence;
};

export type AuditFinding = AuditFindingInput & {
  id: string;
  auditRunId: string;
  createdAt: string;
};

export type AuditSummary = {
  clientSummary: string;
  developerSummary: string;
  immediateActions: string[];
  thisQuarterActions: string[];
  laterImprovements: string[];
};

export type AuditRun = {
  id: string;
  projectId: string;
  repositoryId: string;
  repository: RepositoryInfo;
  status: "queued" | "running" | "completed" | "failed";
  score: number;
  riskLevel: RiskLevel;
  startedAt: string;
  completedAt?: string;
  error?: string;
  stack: StackProfile;
  summary: AuditSummary;
  findings: AuditFinding[];
};

export type RuleDefinition = {
  id: string;
  title: string;
  category: AuditCategory;
  defaultSeverity: Severity;
  description: string;
  evaluate: (context: AuditContext) => AuditFindingInput[];
};

export type ScoreBreakdown = {
  score: number;
  riskLevel: RiskLevel;
  penalties: Record<Severity, number>;
  counts: Record<Severity, number>;
};
