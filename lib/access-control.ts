import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSettings } from "@/db/schema";

export type AccessRole = "admin" | "manager" | "finance" | "relations" | "viewer";
export type AccessUser = {
  id: string;
  name: string;
  email: string;
  role: AccessRole;
  status: "active" | "inactive";
};

const roles = new Set<AccessRole>(["admin", "manager", "finance", "relations", "viewer"]);
const permanentlyAllowedSignInEmails = new Set(["mlipsh770@gmail.com"]);

export function bootstrapEmailIsAllowed(email: string) {
  const normalized = email.trim().toLowerCase();
  if (permanentlyAllowedSignInEmails.has(normalized)) return true;
  const allowed = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(normalized);
}

export function parseAccessUsers(value: string | undefined | null): AccessUser[] {
  if (!value) return [];
  try {
    const raw = JSON.parse(value);
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    return raw.flatMap((item): AccessUser[] => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const email = String(value.email || "").trim().toLowerCase();
      const role = String(value.role || "viewer") as AccessRole;
      const status = value.status === "inactive" ? "inactive" : "active";
      if (!email || !roles.has(role) || seen.has(email)) return [];
      seen.add(email);
      return [{
        id: String(value.id || `user-${email}`),
        name: String(value.name || email).trim() || email,
        email,
        role,
        status,
      }];
    });
  } catch {
    return [];
  }
}

export async function getAccessUsers(): Promise<AccessUser[]> {
  const [setting] = await getDb()
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "access_users"))
    .limit(1);
  return parseAccessUsers(setting?.value);
}

export async function isEmailAllowedToSignIn(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (permanentlyAllowedSignInEmails.has(normalized)) return true;
  const users = await getAccessUsers();
  if (!users.length) return bootstrapEmailIsAllowed(email);
  return users.some((user) => user.email === normalized && user.status === "active");
}

export async function isAdministrator(email: string): Promise<boolean> {
  const users = await getAccessUsers();
  if (!users.length) return bootstrapEmailIsAllowed(email);
  const normalized = email.trim().toLowerCase();
  return users.some((user) => user.email === normalized && user.status === "active" && user.role === "admin");
}

export function validateAccessUsers(users: AccessUser[]) {
  const invalid = users.some((user) =>
    !user.name.trim() ||
    !/^\S+@\S+\.\S+$/.test(user.email) ||
    !roles.has(user.role) ||
    (user.status !== "active" && user.status !== "inactive"),
  );
  if (invalid) return "יש לבדוק שלכל משתמש יש שם, כתובת דוא״ל תקינה, תפקיד ומצב תקינים.";
  const emails = users.map((user) => user.email.toLowerCase());
  if (new Set(emails).size !== emails.length) return "אי אפשר לשמור שתי רשומות עם אותה כתובת דוא״ל.";
  if (!users.some((user) => user.status === "active" && user.role === "admin"))
    return "חובה להשאיר לפחות מנהל מערכת פעיל אחד.";
  return null;
}
