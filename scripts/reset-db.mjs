import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.AUDIT_DB_PATH ?? "./data/audit-agent.db";
const absolutePath = path.resolve(process.cwd(), dbPath);

for (const suffix of ["", "-shm", "-wal"]) {
  const target = `${absolutePath}${suffix}`;
  if (fs.existsSync(target)) {
    fs.rmSync(target);
  }
}

console.log(`Removed ${absolutePath} and SQLite sidecar files if present.`);
