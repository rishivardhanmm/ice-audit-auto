import { NextResponse } from "next/server";
import { listLocalProjects } from "@/lib/local/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    projects: await listLocalProjects()
  });
}
