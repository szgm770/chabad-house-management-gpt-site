import { getDb } from "@/db";
import { auditLog } from "@/db/schema";
import { repairDonorModel } from "@/app/donor-model";

export async function POST() {
  try {
    const db = getDb(), result = await repairDonorModel(db);
    await db.insert(auditLog).values({ action: "data_integrity_repair", entityType: "system", entityId: "donor-model", details: JSON.stringify(result) });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "שגיאה" }, { status: 500 });
  }
}
