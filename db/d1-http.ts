type D1Result = { results: Record<string, unknown>[]; success: boolean; meta?: Record<string, unknown> };
type BoundStatement = { sql: string; params: unknown[]; bind: (...params: unknown[]) => BoundStatement; all: () => Promise<D1Result>; run: () => Promise<D1Result>; first: (column?: string) => Promise<Record<string, unknown> | unknown | null>; raw: (options?: { columnNames?: boolean }) => Promise<unknown[][]> };

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`חסרה הגדרת השרת ${name}. יש להוסיף אותה בהגדרות הסביבה של Vercel.`);
  return value;
}

let databaseIdPromise: Promise<string> | undefined;

/**
 * Vercel needs D1's UUID for query calls. To make first-time setup less
 * error-prone we also accept the human-readable D1 database name and resolve
 * it once through Cloudflare's API.
 */
async function databaseId(): Promise<string> {
  const explicitId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  if (explicitId) return explicitId;

  const name = process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim();
  if (!name) {
    throw new Error("חסרה הגדרת המסד. יש להוסיף CLOUDFLARE_D1_DATABASE_ID או CLOUDFLARE_D1_DATABASE_NAME בהגדרות הסביבה של Vercel.");
  }

  databaseIdPromise ??= (async () => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${required("CLOUDFLARE_ACCOUNT_ID")}/d1/database?name=${encodeURIComponent(name)}`, {
      headers: { authorization: `Bearer ${required("CLOUDFLARE_D1_API_TOKEN")}` },
      cache: "no-store",
    });
    const payload = await response.json() as { success?: boolean; errors?: Array<{ message?: string }>; result?: Array<{ uuid?: string; name?: string }> };
    const found = payload.result?.find((database) => database.name === name)?.uuid;
    if (!response.ok || !payload.success || !found) {
      throw new Error(payload.errors?.map((item) => item.message).filter(Boolean).join(", ") || `לא נמצא מסד הנתונים ${name}.`);
    }
    return found;
  })();
  return databaseIdPromise;
}

async function execute(sql: string, params: unknown[]): Promise<D1Result> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${required("CLOUDFLARE_ACCOUNT_ID")}/d1/database/${await databaseId()}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${required("CLOUDFLARE_D1_API_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  });
  const payload = await response.json() as { success?: boolean; errors?: Array<{ message?: string }>; result?: D1Result[] };
  const result = payload.result?.[0];
  if (!response.ok || !payload.success || !result?.success) throw new Error(payload.errors?.map((item) => item.message).filter(Boolean).join(", ") || "לא ניתן להתחבר למסד הנתונים כרגע.");
  return result;
}

function statement(sql: string, params: unknown[] = []): BoundStatement {
  return {
    sql, params,
    bind: (...next) => statement(sql, next),
    all: async () => execute(sql, params),
    run: async () => execute(sql, params),
    first: async (column) => { const row = (await execute(sql, params)).results[0] ?? null; return column && row ? row[column] ?? null : row; },
    raw: async (options) => { const result = await execute(sql, params); const rows = result.results.map((row) => Object.values(row)); return (options?.columnNames && result.results[0] ? [Object.keys(result.results[0]), ...rows] : rows) as unknown[][]; },
  };
}

export function createD1HttpClient(): any {
  return { prepare: (sql: string) => statement(sql), batch: async (items: BoundStatement[]) => Promise.all(items.map((item) => execute(item.sql, item.params))), exec: async (sql: string) => execute(sql, []), dump: async () => new ArrayBuffer(0) };
}
