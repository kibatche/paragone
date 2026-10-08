/**
 * @author [A likely boring stuff made by] Shevek
 * @desc types.ts : Les travaux de scan et de juge lancés depuis l'API.
 */

import type { Usage } from "../cli/usage/types";
import type { ScanSummary } from "../scan/types";

export type JobKind = "scan" | "judge";
export type JobState = "running" | "done" | "error";

export interface JobProgress {
  done: number;
  total: number;
}

/** Un lancement du scan ou du juge. `classes` est vide pour un scan. */
export interface Job {
  id: string;
  kind: JobKind;
  state: JobState;
  started_at: number;
  ended_at: number | null;
  classes: string[];
  progress: JobProgress | null;
  scan: ScanSummary | null;
  usage: Record<string, Usage> | null;
  error: string | null;
}

/** Le travail en cours et le dernier terminé. */
export interface Jobs {
  current: Job | null;
  last: Job | null;
}
