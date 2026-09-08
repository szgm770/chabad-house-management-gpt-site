import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

test("settlement rules, month boundaries, net totals and confirmation", async () => {
 const {expectedDate,monthlyBankSummary,bankSummaryForPeriod,settlementFor,rulesFromSettings}=await vite.ssrLoadModule('/app/settlement.ts');
 const rules=[{method:'אשראי',mode:'next_month',day:1},{method:'ביט',mode:'monthly',day:9},{method:'העברה בנקאית',mode:'days',day:2},{method:'מזומן',mode:'manual',day:1},{method:'צ׳ק',mode:'manual',day:1}];
 assert.equal(expectedDate('2026-09-28','אשראי',rules),'2026-10-01');
 assert.equal(expectedDate('2026-09-28','ביט',rules),'2026-10-09');
 assert.equal(expectedDate('2026-09-28','העברה בנקאית',rules),'2026-09-30');
 assert.equal(expectedDate('2026-09-28','מזומן',rules),null);
 assert.equal(expectedDate('2026-09-28','צ׳ק',rules),null);
 assert.equal(expectedDate('2026-01-31','אשראי',[{method:'אשראי',mode:'next_month',day:31}]),'2026-02-28');
 assert.equal(expectedDate('2026-09-28','אשראי',[{method:'אשראי',mode:'same',day:0}]),'2026-09-28');
 const row={amount:1000,feeAmount:20,currency:'ILS',movementType:'donation',date:'2026-09-28',paymentMethod:'אשראי'};
 assert.deepEqual(monthlyBankSummary([row],rules,'2026-10','2026-09-30'),{gross:0,planned:980,actual:0,pending:980,overdue:0,unplanned:0});
 assert.equal(monthlyBankSummary([row],rules,'2026-09').gross,1000);
 assert.equal(settlementFor(row,rules,'2026-10-02').actual,'2026-10-01');
 assert.equal(settlementFor(row,rules,'2026-10-02').status,'נכנס אוטומטית');
 assert.equal(monthlyBankSummary([row],rules,'2026-10','2026-10-02').actual,980);
 assert.equal(monthlyBankSummary([row],rules,'2026-10','2026-10-02').pending,0);
 assert.equal(settlementFor({...row,settlementReview:true},rules,'2026-10-02').actual,null);
 assert.equal(settlementFor({...row,settlementReview:true},rules,'2026-10-02').status,'דורש בדיקה');
 assert.equal(bankSummaryForPeriod([row],rules,'year','2026-01-01','2026-10-02').actual,980);
 assert.equal(bankSummaryForPeriod([row],rules,'all','2026-01-01','2026-10-02').gross,1000);
 assert.equal(bankSummaryForPeriod([row],rules,'all','2026-01-01','2026-10-02').net,980);
 assert.equal(bankSummaryForPeriod([row],rules,'month','2026-09-01','2026-09-30').pending,980);
 assert.equal(bankSummaryForPeriod([row],rules,'month','2026-10-01','2026-09-30').pending,0);
 assert.equal(monthlyBankSummary([{...row,actualSettlementDate:'2026-10-03'}],rules,'2026-10').actual,980);
 assert.equal(monthlyBankSummary([{...row,actualSettlementDate:'2026-10-03'}],rules,'2026-10').pending,0);
 assert.equal(settlementFor({...row,expectedSettlementDate:'2026-11-05'},rules).expected,'2026-11-05');
 assert.equal(rulesFromSettings({})[0].mode,'manual');
});

test("dashboard uses settled net cash once and separates departments and expenses", async () => {
 const {dashboardFinanceSummary}=await vite.ssrLoadModule('/app/dashboard-finance-data.ts');
 const rules=[{method:'אשראי',mode:'next_month',day:1}];
 const rows=[
  {amount:1000,feeAmount:20,currency:'ILS',movementType:'donation',date:'2026-09-28',paymentMethod:'אשראי',department:'בית חב״ד'},
  {amount:200,feeAmount:0,currency:'ILS',movementType:'expense',date:'2026-10-03',paymentMethod:'מזומן',actualSettlementDate:'2026-10-03',department:'בית חב״ד'},
  {amount:500,feeAmount:0,currency:'ILS',movementType:'donation',date:'2026-10-08',paymentMethod:'אשראי',department:'חנות'},
 ];
 const result=dashboardFinanceSummary(rows,rules,['בית חב״ד','בית כנסת','חנות'],'2026-10-05');
 assert.deepEqual(result.departments.find(x=>x.name==='בית חב״ד'),{name:'בית חב״ד',income:980,expenses:200,balance:780});
 assert.deepEqual(result.departments.find(x=>x.name==='בית כנסת'),{name:'בית כנסת',income:0,expenses:0,balance:0});
 assert.deepEqual(result.totals,{income:980,expenses:200,balance:780});
 assert.equal(result.months.find(x=>x.key==='2026-10').income,980);
 assert.equal(result.months.find(x=>x.key==='2026-10').expenses,200);
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits responsive, accessible application styles", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /100dvh/);
  assert.match(css, /touch-action:\s*pan-y/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /min-height:\s*44px/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("validates and normalizes Hebrew special dates without leaking NaN", async () => {
  const { normalizeSpecialDates, SpecialDateValidationError } = await vite.ssrLoadModule(
    "/app/special-date-validation.ts",
  );
  assert.deepEqual(normalizeSpecialDates([{ kind: "יארצייט", hebrewDay: "י״ז", hebrewMonth: "סיוון", hebrewYear: "תשפ״ו" }]), [{
    kind: "יארצייט", customName: "", hebrewDay: 17, hebrewMonth: "סיוון", hebrewYear: 5786, notes: "",
  }]);
  assert.throws(
    () => normalizeSpecialDates([{ kind: "יארצייט", hebrewDay: "NaN", hebrewMonth: "סיוון", hebrewYear: "NaN" }]),
    (error) => error instanceof SpecialDateValidationError && /יום עברי תקין/.test(error.message),
  );
});
