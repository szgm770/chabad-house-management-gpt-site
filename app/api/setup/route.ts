import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";

type D1Client = { exec: (sql: string) => Promise<{ results?: Array<{ id?: string }> }> };

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "נדרשת כניסה למערכת." }, { status: 401 });
  try {
    const client = (getDb() as unknown as { $client: D1Client }).$client;
    await client.exec("CREATE TABLE IF NOT EXISTS __app_migration_steps (migration_id TEXT NOT NULL, step_number INTEGER NOT NULL, applied_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY (migration_id, step_number))");
    const applied = await client.exec("SELECT migration_id || ':' || step_number AS id FROM __app_migration_steps");
    const appliedSteps = new Set((applied.results ?? []).map((row) => row.id).filter((id): id is string => Boolean(id)));
    const directory = path.join(process.cwd(), "drizzle");
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
    let appliedCount = 0;
    for (const file of files) {
      const migrationId = file.slice(0, -4);
      const sql = await readFile(path.join(directory, file), "utf8");
      const steps = sql.split("--> statement-breakpoint").map((step) => step.trim()).filter(Boolean);
      for (const [index, step] of steps.entries()) {
        const key = `${migrationId}:${index}`;
        if (appliedSteps.has(key)) continue;
        try {
          await client.exec(step);
        } catch (error) {
          const message = error instanceof Error ? error.message.toLowerCase() : "";
          const safeAlreadyApplied = message.includes("duplicate column name") || message.includes("already exists");
          if (!safeAlreadyApplied) throw error;
        }
        await client.exec(`INSERT INTO __app_migration_steps (migration_id, step_number) VALUES (${quote(migrationId)}, ${index})`);
        appliedCount++;
      }
    }
    return Response.json({ ok: true, message: appliedCount ? `מסד הנתונים עודכן בהצלחה: ${appliedCount} שלבים הושלמו.` : "מסד הנתונים כבר מוכן לשימוש." });
  } catch {
    return Response.json({ error: "לא ניתן להשלים את עדכון מסד הנתונים כרגע. נסה שוב." }, { status: 500 });
  }
}
function quote(value: string) { return `'${value.replaceAll("'", "''")}'`; }
