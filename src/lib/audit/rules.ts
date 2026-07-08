import { priorityForSeverity, severityRank } from "./priorities";
import type {
  AuditContext,
  AuditFindingInput,
  Confidence,
  RepositoryFile,
  RuleDefinition
} from "./types";

const codeExtensions = new Set([
  ".cs",
  ".css",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".ts",
  ".tsx"
]);

export const auditRules: RuleDefinition[] = [
  {
    id: "SEC001_SECRET_PATTERN_DETECTED",
    title: "Potential secret committed to the repository",
    category: "security",
    defaultSeverity: "critical",
    description: "Detects high-risk credential patterns in committed text files.",
    evaluate: secretPatternFindings
  },
  {
    id: "SEC002_COMMITTED_ENV_FILE",
    title: "Runtime environment file is committed",
    category: "security",
    defaultSeverity: "critical",
    description: "Flags .env-style files that may contain operational secrets.",
    evaluate: committedEnvironmentFiles
  },
  {
    id: "DOC001_MISSING_ENV_EXAMPLE",
    title: "Missing .env.example for required configuration",
    category: "documentation",
    defaultSeverity: "high",
    description: "Finds environment-variable usage without a safe example file.",
    evaluate: missingEnvExample
  },
  {
    id: "DOC002_MISSING_README",
    title: "README is missing",
    category: "documentation",
    defaultSeverity: "high",
    description: "Checks whether the repository has a visible onboarding document.",
    evaluate: missingReadme
  },
  {
    id: "DOC003_WEAK_README_SETUP",
    title: "README lacks setup and operating guidance",
    category: "documentation",
    defaultSeverity: "medium",
    description: "Checks whether README content explains setup, environment, and running the project.",
    evaluate: weakReadme
  },
  {
    id: "TEST001_MISSING_TEST_COVERAGE_SIGNAL",
    title: "No tests detected",
    category: "testing",
    defaultSeverity: "high",
    description: "Looks for common test directories and test/spec file names.",
    evaluate: missingTests
  },
  {
    id: "TEST002_MISSING_TEST_COMMAND",
    title: "No reliable test command",
    category: "testing",
    defaultSeverity: "high",
    description: "Checks package.json for a real test script.",
    evaluate: missingTestCommand
  },
  {
    id: "BUILD001_MISSING_BUILD_COMMAND",
    title: "Build command is missing",
    category: "build",
    defaultSeverity: "high",
    description: "Checks whether application repositories expose a build command.",
    evaluate: missingBuildCommand
  },
  {
    id: "DEP001_NPM_AUDIT_VULNERABILITY",
    title: "npm audit vulnerability",
    category: "dependencies",
    defaultSeverity: "high",
    description: "Imports npm audit evidence when a package lock is available.",
    evaluate: npmAuditVulnerabilities
  },
  {
    id: "DEP002_UNPINNED_PACKAGE_VERSIONS",
    title: "Dependency versions are not pinned",
    category: "dependencies",
    defaultSeverity: "medium",
    description: "Finds wildcard, latest, range, and floating dependency versions.",
    evaluate: unpinnedDependencies
  },
  {
    id: "DEP003_MISSING_LOCKFILE",
    title: "Package lockfile is missing",
    category: "dependencies",
    defaultSeverity: "medium",
    description: "Checks whether JavaScript projects commit a package manager lockfile.",
    evaluate: missingLockfile
  },
  {
    id: "MAINT001_MISSING_LINTING",
    title: "Linting is not configured",
    category: "maintainability",
    defaultSeverity: "medium",
    description: "Checks for ESLint configuration or a lint script.",
    evaluate: missingLinting
  },
  {
    id: "MAINT002_MISSING_FORMATTER",
    title: "Formatting is not configured",
    category: "maintainability",
    defaultSeverity: "low",
    description: "Checks for Prettier configuration or a format script.",
    evaluate: missingFormatter
  },
  {
    id: "MAINT003_LARGE_SOURCE_FILES",
    title: "Large source files increase maintenance risk",
    category: "maintainability",
    defaultSeverity: "medium",
    description: "Flags source files that are unusually large by line count or byte size.",
    evaluate: largeSourceFiles
  },
  {
    id: "MAINT004_TODO_FIXME_DEBT",
    title: "TODO/FIXME technical debt is present",
    category: "maintainability",
    defaultSeverity: "low",
    description: "Counts TODO and FIXME markers in source and documentation files.",
    evaluate: todoFixmeDebt
  },
  {
    id: "CICD001_MISSING_PIPELINE",
    title: "CI/CD pipeline is missing",
    category: "ci_cd",
    defaultSeverity: "high",
    description: "Checks for common CI pipeline files.",
    evaluate: missingCiPipeline
  },
  {
    id: "DEPLOY001_MISSING_DEPLOYMENT_GUIDANCE",
    title: "Deployment instructions or configuration are missing",
    category: "deployment",
    defaultSeverity: "medium",
    description: "Checks whether deployable apps include deployment config or README guidance.",
    evaluate: missingDeploymentGuidance
  },
  {
    id: "LIC001_MISSING_LICENSE",
    title: "License is missing",
    category: "licensing",
    defaultSeverity: "medium",
    description: "Checks for package license metadata or a LICENSE file.",
    evaluate: missingLicense
  },
  {
    id: "OBS001_MISSING_OBSERVABILITY_SIGNAL",
    title: "Monitoring and logging signals are weak",
    category: "observability",
    defaultSeverity: "medium",
    description: "Looks for common logging, error tracking, and telemetry packages or config.",
    evaluate: missingObservability
  },
  {
    id: "MAINT005_TYPESCRIPT_STRICT_DISABLED",
    title: "TypeScript strictness is not enabled",
    category: "maintainability",
    defaultSeverity: "medium",
    description: "Checks tsconfig.json for strict mode.",
    evaluate: typescriptStrictDisabled
  }
];

export function runAuditRules(context: AuditContext): AuditFindingInput[] {
  return auditRules
    .flatMap((rule) => rule.evaluate(context))
    .sort((left, right) => {
      const severityDelta = severityRank[right.severity] - severityRank[left.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return left.title.localeCompare(right.title);
    });
}

function makeFinding(input: Omit<AuditFindingInput, "priority"> & { priority?: AuditFindingInput["priority"] }): AuditFindingInput {
  return {
    ...input,
    priority: input.priority ?? priorityForSeverity(input.severity)
  };
}

function secretPatternFindings(context: AuditContext): AuditFindingInput[] {
  const findings: AuditFindingInput[] = [];

  for (const file of context.files) {
    if (!file.content || shouldSkipSecretScan(file)) {
      continue;
    }

    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = detectSecret(line);

      if (!match) {
        continue;
      }

      findings.push(
        makeFinding({
          ruleId: "SEC001_SECRET_PATTERN_DETECTED",
          title: "Potential secret committed to the repository",
          description: "A committed text file contains a value that matches a credential-like pattern.",
          category: "security",
          severity: "critical",
          evidence: `${file.path}:${index + 1} contains ${match.label}: ${redact(line.trim())}`,
          affectedFile: file.path,
          recommendedFix:
            "Remove the secret from git history if real, rotate the credential, and replace committed values with environment variables plus .env.example placeholders.",
          estimatedEffort: "M",
          businessImpact:
            "Exposed credentials can lead to account takeover, data access, service abuse, and urgent client escalation.",
          canAiFix: false,
          confidence: match.confidence
        })
      );

      if (findings.length >= 10) {
        return findings;
      }
    }
  }

  return findings;
}

function committedEnvironmentFiles(context: AuditContext): AuditFindingInput[] {
  return context.files
    .filter((file) => isCommittedEnvFile(file.path))
    .slice(0, 8)
    .map((file) =>
      makeFinding({
        ruleId: "SEC002_COMMITTED_ENV_FILE",
        title: "Runtime environment file is committed",
        description: "The repository contains a runtime .env file. These files often hold secrets or production configuration.",
        category: "security",
        severity: "critical",
        evidence: `${file.path} is present in the repository.`,
        affectedFile: file.path,
        recommendedFix:
          "Remove runtime .env files from source control, add them to .gitignore, and commit a safe .env.example instead.",
        estimatedEffort: "S",
        businessImpact:
          "Committing environment files can expose credentials and client-specific configuration.",
        canAiFix: false,
        confidence: "high"
      })
    );
}

function missingEnvExample(context: AuditContext): AuditFindingInput[] {
  const envReference = context.files.find(
    (file) =>
      file.content &&
      /\b(process\.env|import\.meta\.env|os\.environ|System\.getenv|dotenv|env\.get)\b/i.test(file.content)
  );
  const hasExample = context.files.some((file) => file.path.toLowerCase() === ".env.example");

  if (!envReference || hasExample) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DOC001_MISSING_ENV_EXAMPLE",
      title: "Missing .env.example for required configuration",
      description: "The code references environment variables, but the repository does not include a safe example file.",
      category: "documentation",
      severity: "high",
      evidence: `${envReference.path} references environment configuration and .env.example was not found.`,
      affectedFile: envReference.path,
      recommendedFix:
        "Add .env.example with non-secret placeholder keys required to run the project locally and in deployment.",
      estimatedEffort: "S",
      businessImpact:
        "New developers and client teams may not be able to configure the project reliably.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingReadme(context: AuditContext): AuditFindingInput[] {
  if (readmeFile(context.files)) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DOC002_MISSING_README",
      title: "README is missing",
      description: "No README file was found at the repository root.",
      category: "documentation",
      severity: "high",
      evidence: "No root README.md, README.txt, or README file was found.",
      recommendedFix:
        "Add a README with project purpose, setup, environment variables, test commands, build commands, and deployment steps.",
      estimatedEffort: "M",
      businessImpact:
        "Client handover and onboarding become slower, less repeatable, and harder to audit.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function weakReadme(context: AuditContext): AuditFindingInput[] {
  const readme = readmeFile(context.files);

  if (!readme?.content) {
    return [];
  }

  const content = readme.content.toLowerCase();
  const hasSetup = /(install|setup|getting started|npm install|pnpm install|yarn install|pip install|docker compose)/i.test(content);
  const hasRun = /(run|start|dev|serve|npm run dev|python|uvicorn|dotnet run)/i.test(content);
  const hasEnv = /(environment|\.env|configuration|config)/i.test(content);
  const hasDeployment = /(deploy|deployment|production|hosting|vercel|docker|kubernetes|azure|aws|gcp)/i.test(content);
  const weakSignals = [hasSetup, hasRun, hasEnv, hasDeployment].filter(Boolean).length;

  if (readme.content.length >= 700 && weakSignals >= 3) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DOC003_WEAK_README_SETUP",
      title: "README lacks setup and operating guidance",
      description: "The README exists, but it does not appear to cover setup, running, environment, and deployment guidance.",
      category: "documentation",
      severity: "medium",
      evidence: `${readme.path} has ${readme.content.length} characters and ${weakSignals}/4 expected guidance signals.`,
      affectedFile: readme.path,
      recommendedFix:
        "Expand the README with setup steps, required environment variables, local run commands, test commands, build commands, and deployment notes.",
      estimatedEffort: "M",
      businessImpact:
        "Weak documentation increases support load and makes audit evidence harder to explain to clients.",
      canAiFix: true,
      confidence: "medium"
    })
  ];
}

function missingTests(context: AuditContext): AuditFindingInput[] {
  if (!isApplicationRepository(context)) {
    return [];
  }

  const hasTests = context.files.some((file) => {
    const lower = file.path.toLowerCase();
    return (
      lower.includes("__tests__/") ||
      lower.startsWith("test/") ||
      lower.startsWith("tests/") ||
      lower.endsWith(".test.ts") ||
      lower.endsWith(".test.tsx") ||
      lower.endsWith(".test.js") ||
      lower.endsWith(".spec.ts") ||
      lower.endsWith(".spec.tsx") ||
      lower.endsWith(".spec.js") ||
      lower.endsWith("_test.py") ||
      lower.endsWith("test.py")
    );
  });

  if (hasTests) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "TEST001_MISSING_TEST_COVERAGE_SIGNAL",
      title: "No tests detected",
      description: "The scanner did not find common test directories or test/spec file names.",
      category: "testing",
      severity: "high",
      evidence: "No test/, tests/, __tests__/, *.test.*, *.spec.*, or Python *_test.py files were found.",
      recommendedFix:
        "Add smoke tests for core user flows and unit tests around business-critical logic before the next quarterly audit.",
      estimatedEffort: "L",
      businessImpact:
        "Lack of tests increases regression risk and reduces confidence in releases.",
      canAiFix: false,
      confidence: "medium"
    })
  ];
}

function missingTestCommand(context: AuditContext): AuditFindingInput[] {
  const scripts = context.packageJson?.scripts;

  if (!scripts) {
    return [];
  }

  const testScript = scripts.test?.trim();
  if (testScript && !/no test specified|exit 1/i.test(testScript)) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "TEST002_MISSING_TEST_COMMAND",
      title: "No reliable test command",
      description: "package.json does not expose a usable test script.",
      category: "testing",
      severity: "high",
      evidence: testScript ? `package.json test script is "${testScript}".` : "package.json has no test script.",
      affectedFile: "package.json",
      recommendedFix:
        "Add a test script that runs the repository's automated tests in CI and local development.",
      estimatedEffort: "M",
      businessImpact:
        "Without a standard test command, release validation becomes manual and inconsistent.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingBuildCommand(context: AuditContext): AuditFindingInput[] {
  const scripts = context.packageJson?.scripts;
  if (!scripts || !isApplicationRepository(context)) {
    return [];
  }

  if (scripts.build?.trim()) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "BUILD001_MISSING_BUILD_COMMAND",
      title: "Build command is missing",
      description: "The project appears to be an application, but package.json does not expose a build script.",
      category: "build",
      severity: "high",
      evidence: "package.json was found without a build script.",
      affectedFile: "package.json",
      recommendedFix:
        "Add a build script that compiles or verifies the production artifact, then run it in CI.",
      estimatedEffort: "M",
      businessImpact:
        "Missing build automation can hide production-breaking issues until deployment.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function npmAuditVulnerabilities(context: AuditContext): AuditFindingInput[] {
  return context.npmAuditIssues.slice(0, 20).map((issue) =>
    makeFinding({
      ruleId: "DEP001_NPM_AUDIT_VULNERABILITY",
      title: `${capitalize(issue.severity)} vulnerability in ${issue.packageName}`,
      description: issue.title,
      category: "dependencies",
      severity: issue.severity,
      evidence: `npm audit reported ${issue.packageName}${issue.range ? ` (${issue.range})` : ""}: ${issue.via.join(", ") || issue.title}.`,
      affectedFile: "package-lock.json",
      recommendedFix:
        "Review the advisory, upgrade the affected package to a patched version, and run the test suite before release.",
      estimatedEffort: issue.fixAvailable ? "M" : "L",
      businessImpact:
        issue.severity === "critical" || issue.severity === "high"
          ? "Known vulnerable dependencies can create exploitable production risk."
          : "Dependency vulnerabilities increase maintenance and compliance exposure.",
      canAiFix: Boolean(issue.fixAvailable && issue.severity !== "critical"),
      confidence: "high"
    })
  );
}

function unpinnedDependencies(context: AuditContext): AuditFindingInput[] {
  const dependencies = {
    ...(context.packageJson?.dependencies ?? {}),
    ...(context.packageJson?.devDependencies ?? {})
  };
  const floating = Object.entries(dependencies)
    .filter(([, version]) => /^(latest|\*|\^|~|>=|>|<=|<)/.test(version.trim()))
    .slice(0, 20);

  if (floating.length === 0) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DEP002_UNPINNED_PACKAGE_VERSIONS",
      title: "Dependency versions are not pinned",
      description: "Some dependencies use floating or ranged versions, making future installs less reproducible.",
      category: "dependencies",
      severity: "medium",
      evidence: floating.map(([name, version]) => `${name}@${version}`).join(", "),
      affectedFile: "package.json",
      recommendedFix:
        "Pin runtime dependency versions or rely on a committed lockfile plus automated dependency update tooling.",
      estimatedEffort: "M",
      businessImpact:
        "Floating versions can cause unexpected behavior changes between quarterly audits.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingLockfile(context: AuditContext): AuditFindingInput[] {
  if (!context.packageJson) {
    return [];
  }

  const lockfile = context.files.some((file) =>
    ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "npm-shrinkwrap.json"].includes(
      file.path.toLowerCase()
    )
  );

  if (lockfile) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DEP003_MISSING_LOCKFILE",
      title: "Package lockfile is missing",
      description: "A JavaScript package manifest exists without a committed package-manager lockfile.",
      category: "dependencies",
      severity: "medium",
      evidence: "package.json was found, but package-lock.json, pnpm-lock.yaml, yarn.lock, or bun.lockb was not found.",
      affectedFile: "package.json",
      recommendedFix:
        "Commit the lockfile generated by the package manager used for this project.",
      estimatedEffort: "S",
      businessImpact:
        "Missing lockfiles make installs less reproducible and complicate vulnerability auditing.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingLinting(context: AuditContext): AuditFindingInput[] {
  if (!context.packageJson) {
    return [];
  }

  const hasConfig = context.files.some((file) => {
    const lower = file.path.toLowerCase();
    return lower.includes("eslint.config") || lower.startsWith(".eslintrc");
  });
  const hasScript = Boolean(context.packageJson.scripts?.lint);

  if (hasConfig || hasScript) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "MAINT001_MISSING_LINTING",
      title: "Linting is not configured",
      description: "No ESLint configuration or lint script was found.",
      category: "maintainability",
      severity: "medium",
      evidence: "No eslint.config.*, .eslintrc*, or package.json lint script was found.",
      affectedFile: "package.json",
      recommendedFix:
        "Add ESLint configuration and a lint script, then run linting in CI.",
      estimatedEffort: "M",
      businessImpact:
        "Missing linting allows avoidable code quality problems to accumulate.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingFormatter(context: AuditContext): AuditFindingInput[] {
  if (!context.packageJson) {
    return [];
  }

  const hasPrettier = context.files.some((file) => {
    const lower = file.path.toLowerCase();
    return lower.includes("prettier") || lower === ".prettierrc" || lower === ".prettierrc.json";
  });
  const hasFormatScript = Boolean(context.packageJson.scripts?.format);

  if (hasPrettier || hasFormatScript) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "MAINT002_MISSING_FORMATTER",
      title: "Formatting is not configured",
      description: "No formatter configuration or format script was found.",
      category: "maintainability",
      severity: "low",
      evidence: "No Prettier config or package.json format script was found.",
      affectedFile: "package.json",
      recommendedFix:
        "Add a formatter config and a standard format script to reduce review noise.",
      estimatedEffort: "S",
      businessImpact:
        "Inconsistent formatting slows code review and contributes to avoidable churn.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function largeSourceFiles(context: AuditContext): AuditFindingInput[] {
  const largeFiles = context.files
    .filter((file) => codeExtensions.has(file.extension) && (file.lineCount > 600 || file.sizeBytes > 400_000))
    .sort((left, right) => right.lineCount - left.lineCount)
    .slice(0, 8);

  if (largeFiles.length === 0) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "MAINT003_LARGE_SOURCE_FILES",
      title: "Large source files increase maintenance risk",
      description: "Large files are harder to review, test, and safely modify.",
      category: "maintainability",
      severity: "medium",
      evidence: largeFiles
        .map((file) => `${file.path} (${file.lineCount} lines, ${Math.round(file.sizeBytes / 1024)} KB)`)
        .join("; "),
      affectedFile: largeFiles[0]?.path,
      recommendedFix:
        "Split high-churn large files into smaller modules with focused responsibilities and tests.",
      estimatedEffort: "L",
      businessImpact:
        "Large files increase regression risk and slow client-requested changes.",
      canAiFix: false,
      confidence: "high"
    })
  ];
}

function todoFixmeDebt(context: AuditContext): AuditFindingInput[] {
  const matches = context.files
    .filter((file) => file.content)
    .map((file) => ({
      file,
      count: (file.content?.match(/\b(TODO|FIXME|HACK)\b/gi) ?? []).length
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count);

  const total = matches.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "MAINT004_TODO_FIXME_DEBT",
      title: "TODO/FIXME technical debt is present",
      description: "The repository contains unresolved TODO, FIXME, or HACK markers.",
      category: "maintainability",
      severity: "low",
      evidence: `Found ${total} markers. Top files: ${matches
        .slice(0, 8)
        .map((item) => `${item.file.path} (${item.count})`)
        .join(", ")}.`,
      affectedFile: matches[0]?.file.path,
      recommendedFix:
        "Triage markers, convert real work into tracked issues, and remove stale comments.",
      estimatedEffort: "M",
      businessImpact:
        "Untracked technical debt makes delivery planning less predictable.",
      canAiFix: false,
      confidence: "high"
    })
  ];
}

function missingCiPipeline(context: AuditContext): AuditFindingInput[] {
  if (!isApplicationRepository(context) || context.stack.cicd.length > 0) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "CICD001_MISSING_PIPELINE",
      title: "CI/CD pipeline is missing",
      description: "No common CI/CD workflow file was found.",
      category: "ci_cd",
      severity: "high",
      evidence: "No .github/workflows, .gitlab-ci.yml, azure-pipelines.yml, or Jenkinsfile was detected.",
      recommendedFix:
        "Add a CI workflow that runs install, lint, tests, and build for pull requests.",
      estimatedEffort: "M",
      businessImpact:
        "Manual validation increases release risk and makes quality gates harder to evidence to clients.",
      canAiFix: true,
      confidence: "high"
    })
  ];
}

function missingDeploymentGuidance(context: AuditContext): AuditFindingInput[] {
  if (!isApplicationRepository(context)) {
    return [];
  }

  const readme = readmeFile(context.files);
  const readmeHasDeploy = Boolean(readme?.content && /(deploy|deployment|production|hosting)/i.test(readme.content));

  if (context.stack.deployment.length > 0 || readmeHasDeploy) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "DEPLOY001_MISSING_DEPLOYMENT_GUIDANCE",
      title: "Deployment instructions or configuration are missing",
      description: "The scanner did not find deployment config or README deployment guidance.",
      category: "deployment",
      severity: "medium",
      evidence: "No Dockerfile, docker-compose, Vercel, Netlify, Render, Fly.io, Railway, Procfile, Kubernetes config, or README deployment section was detected.",
      recommendedFix:
        "Add deployment documentation and, where appropriate, infrastructure or container configuration.",
      estimatedEffort: "M",
      businessImpact:
        "Deployment knowledge may be trapped with individuals, increasing operational risk during handover.",
      canAiFix: true,
      confidence: "medium"
    })
  ];
}

function missingLicense(context: AuditContext): AuditFindingInput[] {
  const hasLicenseFile = context.files.some((file) => file.path.toLowerCase().startsWith("license"));
  const hasPackageLicense = Boolean(context.packageJson?.license);

  if (hasLicenseFile || hasPackageLicense || context.packageJson?.private) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "LIC001_MISSING_LICENSE",
      title: "License is missing",
      description: "No repository license file or package license metadata was found.",
      category: "licensing",
      severity: "medium",
      evidence: context.packageJson
        ? "package.json has no license field and no LICENSE file was found."
        : "No LICENSE file was found.",
      affectedFile: context.packageJson ? "package.json" : undefined,
      recommendedFix:
        "Confirm the intended license with the project owner and add a LICENSE file or package metadata.",
      estimatedEffort: "S",
      businessImpact:
        "Missing license metadata can create client compliance and reuse uncertainty.",
      canAiFix: false,
      confidence: "medium"
    })
  ];
}

function missingObservability(context: AuditContext): AuditFindingInput[] {
  if (!isApplicationRepository(context)) {
    return [];
  }

  const packages = {
    ...(context.packageJson?.dependencies ?? {}),
    ...(context.packageJson?.devDependencies ?? {})
  };
  const packageNames = Object.keys(packages).join(" ");
  const contentSignal = context.files.some(
    (file) =>
      file.content &&
      /(sentry|datadog|opentelemetry|newrelic|rollbar|bugsnag|winston|pino|loguru|structlog|logging\.getLogger)/i.test(
        file.content
      )
  );
  const packageSignal = /(sentry|datadog|opentelemetry|newrelic|rollbar|bugsnag|winston|pino)/i.test(packageNames);

  if (contentSignal || packageSignal) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "OBS001_MISSING_OBSERVABILITY_SIGNAL",
      title: "Monitoring and logging signals are weak",
      description: "No common error tracking, telemetry, or structured logging signal was detected.",
      category: "observability",
      severity: "medium",
      evidence: "No Sentry, Datadog, OpenTelemetry, New Relic, Rollbar, Bugsnag, Winston, Pino, or Python logging signal was found.",
      recommendedFix:
        "Add error tracking and structured logging around production entry points and critical workflows.",
      estimatedEffort: "M",
      businessImpact:
        "Production issues may take longer to detect, explain, and resolve for clients.",
      canAiFix: false,
      confidence: "low"
    })
  ];
}

function typescriptStrictDisabled(context: AuditContext): AuditFindingInput[] {
  const tsconfig = context.files.find((file) => file.path.toLowerCase() === "tsconfig.json" && file.content);

  if (!tsconfig?.content) {
    return [];
  }

  if (/"strict"\s*:\s*true/i.test(tsconfig.content)) {
    return [];
  }

  return [
    makeFinding({
      ruleId: "MAINT005_TYPESCRIPT_STRICT_DISABLED",
      title: "TypeScript strictness is not enabled",
      description: "tsconfig.json does not explicitly enable strict type checking.",
      category: "maintainability",
      severity: "medium",
      evidence: "tsconfig.json does not contain \"strict\": true.",
      affectedFile: "tsconfig.json",
      recommendedFix:
        "Enable strict mode incrementally or document the migration plan with targeted exceptions.",
      estimatedEffort: "L",
      businessImpact:
        "Weaker type checks can allow runtime defects to escape into production.",
      canAiFix: false,
      confidence: "high"
    })
  ];
}

function isCommittedEnvFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const name = lower.split("/").pop() ?? lower;
  return name.startsWith(".env") && !name.includes("example") && !name.includes("sample") && !name.endsWith(".template");
}

function readmeFile(files: RepositoryFile[]): RepositoryFile | undefined {
  return files.find((file) => /^readme(\.|$)/i.test(file.path));
}

function shouldSkipSecretScan(file: RepositoryFile): boolean {
  const lower = file.path.toLowerCase();
  return (
    lower.includes("package-lock.json") ||
    lower.includes("pnpm-lock.yaml") ||
    lower.includes("yarn.lock") ||
    lower.includes("snapshot") ||
    lower.includes("testdata") ||
    lower.endsWith(".svg")
  );
}

function detectSecret(line: string): { label: string; confidence: Confidence } | undefined {
  if (/AKIA[0-9A-Z]{16}/.test(line)) {
    return { label: "AWS access key pattern", confidence: "high" };
  }

  if (/-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/.test(line)) {
    return { label: "private key block", confidence: "high" };
  }

  const assignment = /\b(api[_-]?key|secret|token|password|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*["']?([A-Za-z0-9_./+=:-]{20,})["']?/i.exec(
    line
  );

  if (!assignment) {
    return undefined;
  }

  const value = assignment[2].toLowerCase();
  const placeholder =
    value.includes("process.env") ||
    value.includes("example") ||
    value.includes("placeholder") ||
    value.includes("changeme") ||
    value.includes("your_") ||
    value.includes("xxxx") ||
    value.includes("dummy");

  if (placeholder) {
    return undefined;
  }

  return { label: `${assignment[1]} assignment`, confidence: "medium" };
}

function redact(value: string): string {
  if (value.length <= 18) {
    return "[redacted]";
  }

  return `${value.slice(0, 10)}...[redacted]`;
}

function isApplicationRepository(context: AuditContext): boolean {
  return (
    Boolean(context.packageJson) ||
    context.stack.frameworks.length > 0 ||
    context.stack.languages.some((language) => ["Python", "Java", ".NET"].includes(language))
  );
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
