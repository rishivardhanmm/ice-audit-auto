import { calculateScore } from "@/lib/audit/scoring";
import { runNpmAudit } from "@/lib/audit/npm-audit";
import { runAuditRules } from "@/lib/audit/rules";
import { summarizeAudit } from "@/lib/audit/summarizer";
import type { AuditContext, AuditRun } from "@/lib/audit/types";
import { parsePackageJson, detectStack } from "@/lib/audit/stack-detection";
import {
  cloneRepository,
  collectRepositoryFiles,
  createLocalRepositoryInfo,
  parseGitHubRepositoryUrl
} from "@/lib/github/repository";
import {
  completeAuditRun,
  createRunningAuditRun,
  failAuditRun
} from "@/lib/db/database";

export type AuditJobInput =
  | {
      source: "github";
      repositoryUrl: string;
    }
  | {
      source: "local";
      localPath: string;
    };

export async function runAuditJob(input: AuditJobInput): Promise<AuditRun> {
  const repository =
    input.source === "github"
      ? parseGitHubRepositoryUrl(input.repositoryUrl)
      : await createLocalRepositoryInfo(input.localPath);
  const { auditRunId } = createRunningAuditRun(repository);
  let cloned: Awaited<ReturnType<typeof cloneRepository>> | undefined;

  try {
    const rootPath =
      repository.source === "github"
        ? (cloned = await cloneRepository(repository)).rootPath
        : repository.localPath ?? repository.cloneUrl;
    const files = await collectRepositoryFiles(rootPath);
    const packageJson = parsePackageJson(files);
    const stack = detectStack(files, packageJson);
    const npmAuditIssues = await runNpmAudit(rootPath, files);

    const context: AuditContext = {
      repository,
      rootPath,
      files,
      packageJson,
      stack,
      npmAuditIssues,
      scannedAt: new Date().toISOString()
    };
    const findings = runAuditRules(context);
    const score = calculateScore(findings);
    const summary = await summarizeAudit({
      score: score.score,
      riskLevel: score.riskLevel,
      stack,
      findings
    });

    return completeAuditRun({
      auditRunId,
      score: score.score,
      riskLevel: score.riskLevel,
      stack,
      summary,
      findings
    });
  } catch (error) {
    const failed = failAuditRun(auditRunId, error instanceof Error ? error.message : "Unknown audit failure");
    if (failed) {
      return failed;
    }

    throw error;
  } finally {
    await cloned?.cleanup().catch(() => undefined);
  }
}
