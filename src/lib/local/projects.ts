import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { normalizePath } from "@/lib/github/repository";

export type LocalProjectOption = {
  name: string;
  path: string;
  displayPath: string;
  hints: string[];
};

const ignoredFolderNames = new Set([
  ".git",
  ".next",
  "coverage",
  "data",
  "dist",
  "node_modules",
  "out",
  "tmp"
]);

export async function listLocalProjects(): Promise<LocalProjectOption[]> {
  const roots = uniqueRoots([
    { path: process.cwd(), includeChildren: false },
    { path: path.dirname(process.cwd()), includeChildren: true },
    { path: path.join(os.homedir(), "source", "repos"), includeChildren: true },
    { path: path.join(os.homedir(), "Documents"), includeChildren: true },
    { path: path.join(os.homedir(), "Projects"), includeChildren: true }
  ]);
  const projects: LocalProjectOption[] = [];

  for (const root of roots) {
    const rootStats = await fs.stat(root.path).catch(() => undefined);
    if (!rootStats?.isDirectory()) {
      continue;
    }

    const rootDescription = await describeProject(root.path);
    if (!root.includeChildren || rootDescription.hints.length > 0) {
      projects.push(rootDescription);
    }

    if (!root.includeChildren) {
      continue;
    }

    const entries = await fs.readdir(root.path, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || ignoredFolderNames.has(entry.name.toLowerCase())) {
        continue;
      }

      const fullPath = path.join(root.path, entry.name);
      projects.push(await describeProject(fullPath));
    }
  }

  return uniqueByPath(projects)
    .sort((left, right) => left.displayPath.localeCompare(right.displayPath))
    .slice(0, 120);
}

async function describeProject(projectPath: string): Promise<LocalProjectOption> {
  const entries = await fs.readdir(projectPath, { withFileTypes: true }).catch(() => []);
  const names = new Set(entries.map((entry) => entry.name.toLowerCase()));
  const hints: string[] = [];

  if (names.has(".git")) {
    hints.push("git");
  }

  if (names.has("package.json")) {
    hints.push("node");
  }

  if (names.has("pyproject.toml") || names.has("requirements.txt")) {
    hints.push("python");
  }

  if (names.has("dockerfile") || names.has("docker-compose.yml") || names.has("docker-compose.yaml")) {
    hints.push("docker");
  }

  if (names.has("pom.xml") || [...names].some((name) => name.endsWith(".csproj") || name.endsWith(".sln"))) {
    hints.push("backend");
  }

  return {
    name: path.basename(projectPath),
    path: projectPath,
    displayPath: normalizePath(projectPath),
    hints
  };
}

function uniqueRoots(values: Array<{ path: string; includeChildren: boolean }>): Array<{ path: string; includeChildren: boolean }> {
  const seen = new Map<string, boolean>();

  for (const value of values) {
    const resolved = path.resolve(value.path);
    seen.set(resolved, (seen.get(resolved) ?? false) || value.includeChildren);
  }

  return [...seen.entries()].map(([rootPath, includeChildren]) => ({
    path: rootPath,
    includeChildren
  }));
}

function uniqueByPath(projects: LocalProjectOption[]): LocalProjectOption[] {
  const seen = new Set<string>();
  const output: LocalProjectOption[] = [];

  for (const project of projects) {
    const key = project.path.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(project);
    }
  }

  return output;
}
