/**
 * @desc Types lié(s) au module de scan.
 */

import type { FileStatus } from "../db/constants";

/** Statut du fichier venant de la db */
export type FileOutcome = FileStatus | "unchanged";

/** Bilan d'un scan. */
export interface ScanSummary {
  files: number;
  scanned: number;
  unchanged: number;
  notJs: number;
  parseErrors: number;
  addedLeads: number;
}
