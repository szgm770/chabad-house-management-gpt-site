import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("declares Hebrew RTL application metadata", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /lang="he"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /מערכת ניהול בית חב״ד/);
  assert.match(layout, /favicon\.svg/);
});

test("publishes the production worker entrypoint", async () => {
  const worker = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
  assert.match(worker, /cloudflare:workers/);
  assert.match(worker, /fetch/);
});

test("ships the multi-group relationship CRM contract", async () => {
  const [schema, config, api] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/relationship-config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/retention/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /manualRelationshipGroups/);
  assert.match(schema, /automaticRelationshipGroups/);
  assert.match(schema, /eligibleForRecurringIncrease/);
  assert.match(config, /active_campaign/);
  assert.match(config, /tzach_referrals/);
  assert.match(api, /priorityScore/);
  assert.match(api, /recurringCommitments/);
  assert.match(api, /reviewRecipients/);
});
