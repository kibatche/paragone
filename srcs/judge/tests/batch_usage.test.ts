/**
 * @author [A likely boring stuff made by] Shevek
 * @desc batch_usage.test.ts : Le juge écrit en base une ligne d'usage par lot, y compris quand les leads
 *       d'un lot échouent, et `getUsage` en tire les totaux sans lire events.jsonl.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertIsolated,
  enterTempProject,
  seedCorpus,
} from "../../db/tests/seed";
import { answeringClient, failingClient } from "./stub_client";

const root = enterTempProject();
const corpus = join(root, "corpus");
mkdirSync(corpus);
writeFileSync(
  join(corpus, "app.js"),
  [
    "document.body.innerHTML = location.hash;",
    "document.title.innerHTML = location.search;",
    "",
  ].join("\n"),
);

const { runJudge } = await import("../judge");
const { getUsage } = await import("../../db/usage");
const { getDatabase } = await import("../../db/db");
const { RUN_ID } = await import("../../cli/log/log");
await assertIsolated();
await seedCorpus(corpus);

type UsageRow = {
  run_id: string;
  sink_type: string;
  phase: string;
  batch: number;
  input: number;
  output: number;
  total: number;
  cost: number;
};

function usageRows(): UsageRow[] {
  return getDatabase()
    .query<UsageRow, []>("SELECT * FROM usage ORDER BY id")
    .all();
}

describe("usage écrit par le juge", () => {
  it("écrit une ligne par lot même quand tous les leads du lot échouent", async () => {
    await runJudge(failingClient, "XSS");
    const rows = usageRows();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.batch)).toEqual([1, 2]);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });

  it("écrit l'usage payé de chaque lot, rattaché au lancement, à la classe et à la phase", async () => {
    await runJudge(answeringClient, "XSS");
    const paid = usageRows().slice(2);
    expect(paid).toHaveLength(2);
    for (const row of paid) {
      expect(row.run_id).toBe(RUN_ID);
      expect(row.sink_type).toBe("XSS");
      expect(row.phase).toBe("judge");
      expect(row.input).toBe(100);
      expect(row.output).toBe(10);
      expect(row.total).toBe(110);
      expect(row.cost).toBeCloseTo((100 * 0.042) / 1_000_000);
    }
  });

  it("getUsage totalise par SELECT : global, lancement, classe et phase", () => {
    const usage = getUsage();
    expect(usage.summary.runs).toBe(1);
    expect(usage.summary.batches).toBe(4);
    expect(usage.summary.input).toBe(200);
    expect(usage.summary.total).toBe(220);
    expect(usage.runs).toHaveLength(1);
    expect(usage.runs[0]).toMatchObject({
      run_id: RUN_ID,
      batches: 4,
      phases: ["judge"],
      classes: ["XSS"],
    });
    expect(usage.byClass).toHaveLength(1);
    expect(usage.byClass[0]).toMatchObject({
      sink_type: "XSS",
      phase: "judge",
      total: 220,
    });
    expect(usage.byPhase).toEqual({
      judge: { input: 200, output: 20, cache_read: 0, total: 220 },
    });
  });
});
