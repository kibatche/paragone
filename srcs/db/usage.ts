/**
 * @author [A likely boring stuff made by] Shevek
 * @desc usage.ts : Coûts et tokens dans findings.db : une ligne par lot de jugement, et les agrégats
 *       (par lancement, par classe, par phase, globaux) calculés par SELECT sur cette table.
 */

import { type SQLQueryBindings } from "bun:sqlite";
import { getDatabase, withContext } from "./db";
import type {
  BatchUsageRecord,
  ClassUsage,
  PhaseUsage,
  RunUsage,
  UsageReport,
  UsageSummary,
} from "./types";

const TOTALS_SQL = `count(*) batches, COALESCE(sum(input), 0) input, COALESCE(sum(output), 0) output,
  COALESCE(sum(cache_read), 0) cache_read, COALESCE(sum(cache_write), 0) cache_write,
  COALESCE(sum(total), 0) total, COALESCE(sum(cost), 0) cost`;

export function saveBatchUsage(record: BatchUsageRecord): void {
  const { runId, sinkType, phase, batch, usage } = record;
  withContext("saveBatchUsage", `${phase}:${sinkType}:${batch}`, () =>
    getDatabase()
      .query<null, SQLQueryBindings[]>(
        `INSERT INTO usage (run_id, sink_type, phase, batch, input, output, cache_read, cache_write,
           total, cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        runId,
        sinkType,
        phase,
        batch,
        usage.input,
        usage.output,
        usage.cacheRead,
        usage.cacheWrite,
        usage.total,
        usage.cost,
        Date.now(),
      ),
  );
}

type RunUsageRow = Omit<RunUsage, "phases" | "classes"> & {
  phases: string;
  classes: string;
};

function readRuns(): RunUsage[] {
  const rows = getDatabase()
    .query<RunUsageRow, []>(
      `SELECT run_id, min(created_at) started_at, max(created_at) ended_at,
         group_concat(DISTINCT phase) phases, group_concat(DISTINCT sink_type) classes, ${TOTALS_SQL}
       FROM usage GROUP BY run_id ORDER BY started_at DESC`,
    )
    .all();
  return rows.map((row) => ({
    ...row,
    phases: row.phases.split(","),
    classes: row.classes.split(","),
  }));
}

function readSummary(): UsageSummary {
  const row = getDatabase()
    .query<UsageSummary, []>(
      `SELECT count(DISTINCT run_id) runs, min(created_at) first_run, max(created_at) last_run,
         ${TOTALS_SQL} FROM usage`,
    )
    .get();
  if (!row) throw new Error("Error [readSummary]: aucune ligne d'agrégat");
  return row;
}

function readByClass(): ClassUsage[] {
  return getDatabase()
    .query<ClassUsage, []>(
      `SELECT sink_type, phase, max(created_at) updated_at, ${TOTALS_SQL}
       FROM usage GROUP BY sink_type, phase ORDER BY cost DESC`,
    )
    .all();
}

function readByPhase(): Record<string, PhaseUsage> {
  const rows = getDatabase()
    .query<PhaseUsage & { phase: string }, []>(
      `SELECT phase, sum(input) input, sum(output) output, sum(cache_read) cache_read,
         sum(total) total FROM usage GROUP BY phase`,
    )
    .all();
  return Object.fromEntries(
    rows.map(({ phase, ...tokens }) => [phase, tokens]),
  );
}

/** @brief Lu d'un seul instantané : les quatre agrégats se rapportent à la même base. */
export function getUsage(): UsageReport {
  const database = getDatabase();
  const read = database.transaction(
    (): UsageReport => ({
      summary: readSummary(),
      runs: readRuns(),
      byClass: readByClass(),
      byPhase: readByPhase(),
    }),
  );
  return withContext("getUsage", undefined, read);
}
