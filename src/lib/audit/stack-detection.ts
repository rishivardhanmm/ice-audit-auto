import type { PackageJson, RepositoryFile, StackProfile } from "./types";

export function parsePackageJson(files: RepositoryFile[]): PackageJson | undefined {
  const packageFile = files.find((file) => file.path.toLowerCase() === "package.json" && file.content);

  if (!packageFile?.content) {
    return undefined;
  }

  try {
    return JSON.parse(packageFile.content) as PackageJson;
  } catch {
    return undefined;
  }
}

export function detectStack(files: RepositoryFile[], packageJson?: PackageJson): StackProfile {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const databases = new Set<string>();
  const cicd = new Set<string>();
  const deployment = new Set<string>();
  const tools = new Set<string>();
  const evidence: string[] = [];
  const lowerPaths = files.map((file) => file.path.toLowerCase());
  const allPackages = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
    ...(packageJson?.peerDependencies ?? {})
  };

  const hasPath = (predicate: (path: string) => boolean) => lowerPaths.some(predicate);
  const hasPackage = (name: string) => Object.prototype.hasOwnProperty.call(allPackages, name);

  if (packageJson) {
    languages.add("JavaScript");
    packageManagers.add(hasPath((filePath) => filePath === "pnpm-lock.yaml") ? "pnpm" : "npm");
    evidence.push("package.json found");
  }

  if (hasPath((filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx")) || hasPath((filePath) => filePath === "tsconfig.json")) {
    languages.add("TypeScript");
  }

  if (hasPath((filePath) => filePath.endsWith(".py")) || hasPath((filePath) => ["requirements.txt", "pyproject.toml", "poetry.lock"].includes(filePath))) {
    languages.add("Python");
    packageManagers.add(hasPath((filePath) => filePath === "poetry.lock") ? "Poetry" : "pip");
  }

  if (hasPath((filePath) => filePath.endsWith(".java") || filePath === "pom.xml" || filePath.endsWith("build.gradle"))) {
    languages.add("Java");
    packageManagers.add(hasPath((filePath) => filePath === "pom.xml") ? "Maven" : "Gradle");
  }

  if (hasPath((filePath) => filePath.endsWith(".cs") || filePath.endsWith(".csproj") || filePath.endsWith(".sln"))) {
    languages.add(".NET");
  }

  if (hasPackage("next") || hasPath((filePath) => filePath.startsWith("next.config."))) {
    frameworks.add("Next.js");
    evidence.push("Next.js dependency or config found");
  }

  if (hasPackage("react")) {
    frameworks.add("React");
  }

  if (hasPackage("vue") || hasPath((filePath) => filePath.startsWith("vue.config."))) {
    frameworks.add("Vue");
  }

  if (hasPackage("express")) {
    frameworks.add("Express");
  }

  if (hasPackage("@nestjs/core")) {
    frameworks.add("NestJS");
  }

  if (hasPath((filePath) => filePath.includes("manage.py")) || hasPackage("django")) {
    frameworks.add("Django");
  }

  if (hasPackage("fastapi") || hasPath((filePath) => filePath.includes("requirements.txt") && fileContentIncludes(files, filePath, "fastapi"))) {
    frameworks.add("FastAPI");
  }

  for (const [dependency, label] of [
    ["prisma", "Prisma"],
    ["@prisma/client", "Prisma"],
    ["pg", "PostgreSQL"],
    ["mysql2", "MySQL"],
    ["mongoose", "MongoDB"],
    ["mongodb", "MongoDB"],
    ["redis", "Redis"],
    ["ioredis", "Redis"],
    ["sqlite3", "SQLite"],
    ["better-sqlite3", "SQLite"]
  ] as const) {
    if (hasPackage(dependency)) {
      databases.add(label);
    }
  }

  if (hasPath((filePath) => filePath.includes("sqlalchemy") || filePath.includes("alembic"))) {
    databases.add("SQLAlchemy/Alembic");
  }

  if (hasPath((filePath) => filePath.startsWith(".github/workflows/") && (filePath.endsWith(".yml") || filePath.endsWith(".yaml")))) {
    cicd.add("GitHub Actions");
    evidence.push(".github/workflows contains workflow files");
  }

  if (hasPath((filePath) => filePath === ".gitlab-ci.yml")) {
    cicd.add("GitLab CI");
  }

  if (hasPath((filePath) => filePath === "azure-pipelines.yml")) {
    cicd.add("Azure Pipelines");
  }

  if (hasPath((filePath) => filePath.toLowerCase() === "dockerfile" || filePath.endsWith("/dockerfile"))) {
    deployment.add("Docker");
    tools.add("Docker");
  }

  if (hasPath((filePath) => filePath === "docker-compose.yml" || filePath === "docker-compose.yaml")) {
    deployment.add("Docker Compose");
  }

  for (const [file, label] of [
    ["vercel.json", "Vercel"],
    ["netlify.toml", "Netlify"],
    ["render.yaml", "Render"],
    ["fly.toml", "Fly.io"],
    ["railway.json", "Railway"],
    ["procfile", "Procfile"]
  ] as const) {
    if (hasPath((filePath) => filePath === file)) {
      deployment.add(label);
    }
  }

  if (hasPath((filePath) => filePath.startsWith("k8s/") || filePath.startsWith("kubernetes/"))) {
    deployment.add("Kubernetes");
  }

  if (hasPath((filePath) => filePath.includes("eslint"))) {
    tools.add("ESLint");
  }

  if (hasPath((filePath) => filePath.includes("prettier"))) {
    tools.add("Prettier");
  }

  if (hasPath((filePath) => filePath.includes("semgrep"))) {
    tools.add("Semgrep");
  }

  return {
    languages: [...languages].sort(),
    frameworks: [...frameworks].sort(),
    packageManagers: [...packageManagers].sort(),
    databases: [...databases].sort(),
    cicd: [...cicd].sort(),
    deployment: [...deployment].sort(),
    tools: [...tools].sort(),
    evidence
  };
}

function fileContentIncludes(files: RepositoryFile[], lowerPath: string, search: string): boolean {
  const file = files.find((candidate) => candidate.path.toLowerCase() === lowerPath);
  return file?.content?.toLowerCase().includes(search.toLowerCase()) ?? false;
}
