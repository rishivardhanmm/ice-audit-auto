import OpenAI from "openai";
import { labelForPriority } from "./priorities";
import type { AuditFindingInput, AuditSummary, RiskLevel, StackProfile } from "./types";

type SummaryInput = {
  score: number;
  riskLevel: RiskLevel;
  stack: StackProfile;
  findings: AuditFindingInput[];
};

export async function summarizeAudit(input: SummaryInput): Promise<AuditSummary> {
  if (openAiApiKey()) {
    const aiSummary = await summarizeWithOpenAI(input).catch(() => undefined);
    if (aiSummary) {
      return aiSummary;
    }
  }

  return deterministicSummary(input);
}

async function summarizeWithOpenAI(input: SummaryInput): Promise<AuditSummary | undefined> {
  const client = new OpenAI({
    apiKey: openAiApiKey(),
    baseURL: openAiBaseUrl()
  });

  const evidence = input.findings.slice(0, 40).map((finding) => ({
    title: finding.title,
    category: finding.category,
    severity: finding.severity,
    priority: labelForPriority(finding.priority),
    evidence: finding.evidence,
    affectedFile: finding.affectedFile,
    recommendedFix: finding.recommendedFix,
    businessImpact: finding.businessImpact,
    confidence: finding.confidence
  }));

  const response = await client.responses.create({
    model: openAiModel(),
    instructions:
      "You summarise technical audit findings. Do not invent issues. Use only the provided scan evidence. If evidence is weak, mention low confidence. Return compact JSON only.",
    input: JSON.stringify({
          score: input.score,
          riskLevel: input.riskLevel,
          stack: input.stack,
          findings: evidence,
          requiredShape: {
            clientSummary: "plain English business-facing summary",
            developerSummary: "technical summary grounded in evidence",
            immediateActions: ["top immediate action"],
            thisQuarterActions: ["top this-quarter action"],
            laterImprovements: ["top later improvement"]
          }
        })
  });

  const output = response.output_text;
  if (!output) {
    return undefined;
  }

  const parsed = JSON.parse(extractJsonObject(output)) as Partial<AuditSummary>;

  if (
    typeof parsed.clientSummary !== "string" ||
    typeof parsed.developerSummary !== "string" ||
    !Array.isArray(parsed.immediateActions) ||
    !Array.isArray(parsed.thisQuarterActions) ||
    !Array.isArray(parsed.laterImprovements)
  ) {
    return undefined;
  }

  return {
    clientSummary: parsed.clientSummary,
    developerSummary: parsed.developerSummary,
    immediateActions: parsed.immediateActions.slice(0, 6).map(String),
    thisQuarterActions: parsed.thisQuarterActions.slice(0, 6).map(String),
    laterImprovements: parsed.laterImprovements.slice(0, 6).map(String)
  };
}

function extractJsonObject(output: string): string {
  const trimmed = output.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1]) {
    return extractJsonObject(fenced[1]);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function openAiApiKey(): string | undefined {
  return process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}

function openAiBaseUrl(): string | undefined {
  return process.env.AZURE_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL;
}

function openAiModel(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function deterministicSummary(input: SummaryInput): AuditSummary {
  const byPriority = {
    immediate: input.findings.filter((finding) => finding.priority === "immediate"),
    thisQuarter: input.findings.filter((finding) => finding.priority === "this-quarter"),
    later: input.findings.filter((finding) => finding.priority === "later")
  };
  const topCategories = categorySummary(input.findings);
  const stackLabel = [
    ...input.stack.frameworks,
    ...input.stack.languages.filter((language) => !input.stack.frameworks.includes(language))
  ]
    .slice(0, 4)
    .join(", ");

  return {
    clientSummary:
      input.findings.length === 0
        ? `The audit scored ${input.score}/100 with low current risk. No evidence-backed findings were produced by the automated scan.`
        : `The audit scored ${input.score}/100 with ${input.riskLevel.toLowerCase()} risk. The clearest evidence-backed concerns are in ${topCategories || "general project health"}.`,
    developerSummary:
      input.findings.length === 0
        ? `Detected stack: ${stackLabel || "unknown"}. No automated rules produced findings.`
        : `Detected stack: ${stackLabel || "unknown"}. Prioritise ${byPriority.immediate.length} immediate finding(s), then ${byPriority.thisQuarter.length} this-quarter finding(s). Every recommendation is based on scanner evidence.`,
    immediateActions: actionList(byPriority.immediate, "No immediate action found from scan evidence."),
    thisQuarterActions: actionList(byPriority.thisQuarter, "No this-quarter action found from scan evidence."),
    laterImprovements: actionList(byPriority.later, "No later improvement found from scan evidence.")
  };
}

function categorySummary(findings: AuditFindingInput[]): string {
  const counts = new Map<string, number>();

  for (const finding of findings) {
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([category, count]) => `${category.replace("_", "/")} (${count})`)
    .join(", ");
}

function actionList(findings: AuditFindingInput[], emptyMessage: string): string[] {
  if (findings.length === 0) {
    return [emptyMessage];
  }

  return findings.slice(0, 6).map((finding) => `${finding.title}: ${finding.recommendedFix}`);
}
