import { validSettlementRules } from "@/app/validate-settlement-rules";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getAccessUsers, isAdministrator, parseAccessUsers, validateAccessUsers } from "@/lib/access-control";

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "נדרשת כניסה למערכת." }, { status: 401 });
    const rows = await getDb().select().from(appSettings);
    return Response.json({ settings: Object.fromEntries(rows.map((row) => [row.key, row.value])) });
  } catch {
    return Response.json({ error: "לא ניתן לטעון את ההגדרות כרגע." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "נדרשת כניסה למערכת." }, { status: 401 });
    if (!(await isAdministrator(user.email))) return Response.json({ error: "רק מנהל מערכת יכול לשנות הגדרות." }, { status: 403 });
    const payload = await request.json() as Record<string, string>;
    if (payload.settlement_rules !== undefined && !validSettlementRules(payload.settlement_rules))
      return Response.json({ error: "יש לבדוק את אמצעי התשלום ומועדי הזיכוי" }, { status: 400 });

    let normalizedUsers: ReturnType<typeof parseAccessUsers> | undefined;
    if (payload.access_users !== undefined) {
      normalizedUsers = parseAccessUsers(payload.access_users);
      const previousUsers = await getAccessUsers();
      if (!previousUsers.length && !normalizedUsers.some((item) => item.email === user.email.toLowerCase())) {
        normalizedUsers.unshift({ id: `owner-${user.email.toLowerCase()}`, name: user.displayName || user.email, email: user.email.toLowerCase(), role: "admin", status: "active" });
      }
      const error = validateAccessUsers(normalizedUsers);
      if (error) return Response.json({ error }, { status: 400 });
      payload.access_users = JSON.stringify(normalizedUsers);
      payload.access_enforcement = "enabled";
    }

    const db = getDb();
    for (const [key, value] of Object.entries(payload)) {
      const found = await db.select({ key: appSettings.key }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
      if (found.length) await db.update(appSettings).set({ value, updatedAt: new Date().toISOString() }).where(eq(appSettings.key, key));
      else await db.insert(appSettings).values({ key, value });
    }
    return Response.json({ ok: true, accessUsers: normalizedUsers });
  } catch {
    return Response.json({ error: "לא ניתן לשמור את ההגדרות כרגע. נסה שוב." }, { status: 500 });
  }
}
