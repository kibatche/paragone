/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jobs/model.ts : Schémas des travaux de scan et de juge : leur état et leur bilan.
 */

import { t } from "elysia";

const usage = t.Object({
  input: t.Number(),
  cacheRead: t.Number(),
  cacheWrite: t.Number(),
  output: t.Number(),
  total: t.Number(),
  cost: t.Number({ description: "Coût en dollars." }),
});

const job = t.Object({
  id: t.String(),
  kind: t.String({ description: "scan ou judge." }),
  state: t.String({ description: "running, done ou error." }),
  started_at: t.Number(),
  ended_at: t.Nullable(t.Number()),
  classes: t.Array(t.String(), {
    description: "Classes jugées ; vide pour un scan.",
  }),
  progress: t.Nullable(
    t.Object({
      done: t.Number({ description: "Fichiers scannés, ou leads jugés." }),
      total: t.Number(),
    }),
  ),
  scan: t.Nullable(
    t.Object({
      files: t.Number(),
      scanned: t.Number(),
      unchanged: t.Number(),
      notJs: t.Number(),
      parseErrors: t.Number(),
      addedLeads: t.Number(),
    }),
  ),
  usage: t.Nullable(t.Record(t.String(), usage)),
  error: t.Nullable(t.String()),
});

export const JobsModel = {
  job,
  jobs: t.Object({ current: t.Nullable(job), last: t.Nullable(job) }),
} as const;
