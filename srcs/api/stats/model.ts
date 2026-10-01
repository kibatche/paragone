/**
 * @author [A likely boring stuff made by] Shevek
 * @desc stats/model.ts — Schémas des réponses de `/api/summary` et `/api/tokens`.
 */

import { t } from "elysia";

const breakdown = t.Array(t.Object({ k: t.String(), n: t.Number() }));

const totals = {
  batches: t.Number(),
  input: t.Number(),
  output: t.Number(),
  cache_read: t.Number(),
  cache_write: t.Number(),
  total: t.Number(),
  cost: t.Number({ description: "Coût en dollars." }),
};

export const StatsModel = {
  summary: t.Object({
    totals: t.Object({
      total: t.Number(),
      agent_judged: t.Number(),
      human_reviewed: t.Number(),
    }),
    byClass: breakdown,
    byVerdict: breakdown,
    byAgentScore: breakdown,
    byFileStatus: breakdown,
    byAnalyzer: breakdown,
  }),
  usage: t.Object({
    summary: t.Object({
      ...totals,
      runs: t.Number(),
      first_run: t.Nullable(t.Number()),
      last_run: t.Nullable(t.Number()),
    }),
    runs: t.Array(
      t.Object({
        ...totals,
        run_id: t.String(),
        started_at: t.Number(),
        ended_at: t.Number(),
        phases: t.Array(t.String()),
        classes: t.Array(t.String()),
      }),
    ),
    byClass: t.Array(
      t.Object({
        ...totals,
        sink_type: t.String(),
        phase: t.String(),
        updated_at: t.Number(),
      }),
    ),
    byPhase: t.Record(
      t.String(),
      t.Object({
        input: t.Number(),
        output: t.Number(),
        cache_read: t.Number(),
        total: t.Number(),
      }),
    ),
  }),
} as const;
