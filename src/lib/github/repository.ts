import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { RepositoryFile, RepositoryInfo } from "@/lib/audit/types";

const ignoredDirectories = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",
  "dist",
  "build",
  "out",
  "coverage",
  ".venv",
  "venv",
  "__pycache__",
  "target",
  "bin",
  "obj",
  ".gradle",
  ".idea"
]);

const textExtensions = new Set([
  "",
  ".c",
  ".cc",
  ".cs",
  ".css",
  ".dockerfile",
  ".env",
  ".go",
  ".graphql",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".tsx",
  ".ts",
  ".toml",
  ".txt",
  ".xml",
  ".yaml",
  ".yml"
]);

export function parseGitHubRepositoryUrl(input: string): RepositoryInfo {
  const trimmed = input.trim();
  const httpsMatch = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/)?$/i.exec(
    trimmed
  );
  const sshMatch = /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/i.exec(trimmed);

  const match = httpsMatch ?? sshMatch;
  if (!match) {
    throw new Error("Enter a valid GitHub repository URL, for example https://github.com/owner/repo.");
  }

  const [, owner, name] = match;
  const cloneUrl = `https://github.com/${owner}/${name}.git`;

  return {
    source: "github",
    owner,
    name,
    url: `https://github.com/${owner}/${name}`,
    cloneUrl
  };
}

export async function createLocalRepositoryInfo(inputPath: string): Promise<RepositoryInfo> {
  const absolutePath = path.resolve(inputPath.trim());
  const parsed = path.parse(absolutePath);

  if (absolutePath === parsed.root) {
    throw new Error("Select a project folder instead of a drive or filesystem root.");
  }

  const stats = await fs.stat(absolutePath).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new Error("Local project path does not exist or is not a folder.");
  }

  const name = path.basename(absolutePath);
  const parent = path.basename(path.dirname(absolutePath)) || "local";
  const normalizedPath = normalizePath(absolutePath);

  return {
    source: "local",
    owner: parent,
    name,
    url: `local:${normalizedPath}`,
    cloneUrl: absolutePath,
    localPath: absolutePath
  };
}

export async function cloneRepository(repository: RepositoryInfo): Promise<{ rootPath: string; cleanup: () => Promise<void> }> {
  const workspaceTmp = path.join(process.cwd(), "tmp");
  await fs.mkdir(workspaceTmp, { recursive: true });

  const parentPath = await fs.mkdtemp(path.join(workspaceTmp, "audit-"));
  const rootPath = path.join(parentPath, "repo");
  const token = process.env.GITHUB_TOKEN?.trim();
  const cloneUrl = token
    ? `https://x-access-token:${encodeURIComponent(token)}@github.com/${repository.owner}/${repository.name}.git`
    : repository.cloneUrl;

  const args = ["clone", "--depth", "1", "--single-branch", cloneUrl, rootPath];
  const result = await runCommand("git", args, process.cwd(), 90_000);

  if (result.exitCode !== 0) {
    await fs.rm(parentPath, { recursive: true, force: true });
    throw new Error(`Git clone failed: ${result.stderr || result.stdout || "unknown error"}`);
  }

  return {
    rootPath,
    cleanup: () => fs.rm(parentPath, { recursive: true, force: true })
  };
}

export async function collectRepositoryFiles(rootPath: string): Promise<RepositoryFile[]> {
  const files: RepositoryFile[] = [];
  const maxFiles = 5_000;

  async function walk(currentPath: string) {
    if (files.length >= maxFiles) {
      return;
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        return;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = normalizePath(path.relative(rootPath, absolutePath));

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stats = await fs.stat(absolutePath);
      const extension = path.extname(entry.name).toLowerCase();
      const lowerName = entry.name.toLowerCase();
      const isText =
        textExtensions.has(extension) ||
        lowerName === "dockerfile" ||
        lowerName.startsWith(".env") ||
        lowerName.startsWith("readme") ||
        lowerName.startsWith("license");

      let content: string | undefined;
      let lineCount = 0;

      if (isText && stats.size <= 750_000) {
        try {
          content = await fs.readFile(absolutePath, "utf8");
          lineCount = content.split(/\r?\n/).length;
        } catch {
          content = undefined;
        }
      }

      files.push({
        path: relativePath,
        absolutePath,
        sizeBytes: stats.size,
        extension,
        isText: Boolean(content),
        lineCount,
        content
      });
    }
  }

  await walk(rootPath);
  return files;
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const useShell = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
    const child = spawn(command, args, {
      cwd,
      shell: useShell,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0"
      }
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({
        exitCode: null,
        stdout,
        stderr,
        timedOut: true
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 2_000_000) {
        stdout = stdout.slice(-2_000_000);
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 500_000) {
        stderr = stderr.slice(-500_000);
      }
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      clearTimeout(timer);
      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut: false
      });
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout,
        stderr: error.message,
        timedOut: false
      });
    });
  });
}

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function findFile(files: RepositoryFile[], filePath: string): RepositoryFile | undefined {
  const normalized = filePath.toLowerCase();
  return files.find((file) => file.path.toLowerCase() === normalized);
}

export function hasFile(files: RepositoryFile[], predicate: (filePath: string) => boolean): boolean {
  return files.some((file) => predicate(file.path.toLowerCase()));
}
