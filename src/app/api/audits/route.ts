import { NextResponse } from "next/server";
import { z } from "zod";
import { listAuditRuns } from "@/lib/db/database";
import { runAuditJob } from "@/lib/jobs/audit-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createAuditSchema = z.object({
  source: z.enum(["github", "local"]).default("github"),
  repositoryUrl: z.string().optional(),
  localPath: z.string().optional()
}).superRefine((value, context) => {
  if (value.source === "github") {
    if (!value.repositoryUrl?.startsWith("https://github.com/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["repositoryUrl"],
        message: "Only GitHub HTTPS repository URLs are supported."
      });
    }
    return;
  }

  if (!value.localPath?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["localPath"],
      message: "Local project path is required."
    });
  }
});

export async function GET() {
  return NextResponse.json({
    audits: listAuditRuns(50)
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined);
  const parsed = createAuditSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const auditRun = await runAuditJob(
    parsed.data.source === "github"
      ? {
          source: "github",
          repositoryUrl: parsed.data.repositoryUrl as string
        }
      : {
          source: "local",
          localPath: parsed.data.localPath as string
        }
  );

  return NextResponse.json(
    {
      audit: auditRun
    },
    { status: auditRun.status === "failed" ? 500 : 201 }
  );
}
