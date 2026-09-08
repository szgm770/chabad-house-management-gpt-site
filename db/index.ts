import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { createD1HttpClient } from "./d1-http";

export function getDb() {
  return drizzle(createD1HttpClient(), { schema });
}
