/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc types.ts : Types des entrées et des sorties des fonctions de db.ts, et formes des lignes
 *       lues dans findings.db.
 */

import type { Lead } from "../analyze/constants/lead";
import type { AnalyzerMatch } from "../analyze/constants/types";
import type { Usage } from "../cli/usage/types";
import type { FileStatus, QueueMask } from "./constants";

/** Un jugement du juge, pour une classe, tel que la file et le détail d'un lead le renvoient. */
export interface Judgement {
  class: string;
  score: string;
  note: string;
  reject_reason: string | null;
  confidence: number | null;
  probabilities: Record<string, number> | null;
  model: string | null;
  judged_at: number;
}

/** Ligne de file : lead + contexte (fichier, position, analyzer), sans le JSON du lead. */
export interface ListRow {
  id: number;
  duplicate_of: number | null;
  kind: string;
  classes: string[];
  reconstructed: string;
  verdict: string | null;
  analyzer: string;
  analyzer_name: string;
  method: string | null;
  carrier: string | null;
  file: string;
  line: number;
  priority: number;
  expectation: number | null;
  judgements: Judgement[];
  human_score: string | null;
  reviewed_at: number | null;
}

/**
 * Filtres de file, tous optionnels et combinés en AND. Les cinq `show*` lèvent chacun un masque
 * posé par défaut : ce qu'un humain ne veut pas voir en premier reste en base.
 */
export interface ListFilters {
  cls?: string;
  kind?: string;
  verdict?: string;
  score?: string;
  analyzer?: string;
  humanScore?: string;
  unjudged?: boolean;
  showInventory?: boolean;
  showDuplicates?: boolean;
  showLiteral?: boolean;
  showRejected?: boolean;
  showReviewed?: boolean;
  q?: string;
  duplicateOf?: number;
  limit?: number;
  offset?: number;
}

/** Taille de la file et, par masque encore posé, le nombre de leads qu'il cache en plus. */
export interface QueueCount {
  total: number;
  hidden: Partial<Record<QueueMask, number>>;
}

/** Une ligne de répartition : valeur et effectif. */
export interface Breakdown {
  k: string;
  n: number;
}

/** Compteurs globaux du front et répartitions par classe, verdict, score, statut de fichier, analyzer. */
export interface Summary {
  totals: { total: number; agent_judged: number; human_reviewed: number };
  byClass: Breakdown[];
  byVerdict: Breakdown[];
  byAgentScore: Breakdown[];
  byFileStatus: Breakdown[];
  byAnalyzer: Breakdown[];
}

/** Détail d'un lead : colonnes de `leads`, de son match et de son fichier, `lead` et jugements décodés. */
export interface LeadDetail {
  id: number;
  duplicate_of: number | null;
  kind: string;
  classes: string[];
  reconstructed: string;
  pattern: string | null;
  verdict: string | null;
  lead: Lead;
  human_score: string | null;
  human_note: string | null;
  reviewed_at: number | null;
  analyzer: string;
  match_text: string;
  line: number;
  column: number;
  file: string;
  judgements: Judgement[];
  duplicates: number;
}

/** Position d'un lead dans les sources. */
export interface LeadLocation {
  file: string;
  line: number;
}

/** Résultat du scan d'un fichier, tel que `saveFileScan` l'écrit. */
export interface FileScan {
  path: string;
  sha256: string;
  status: FileStatus;
  error?: string;
  matches: AnalyzerMatch[];
}

/** Un lead à juger, avec ce que `buildCase` demande pour le situer. */
export interface LeadToJudge {
  id: number;
  filePath: string;
  line: number;
  column: number;
  lead: Lead;
}

/** Un verdict du juge pour un couple (lead, classe), tel que `saveJudgement` l'écrit. */
export interface JudgementRecord {
  leadId: number;
  cls: string;
  score: string;
  rejectReason?: string;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
}

/** Ligne brute de la requête des leads à juger ; `lead` est le JSON du lead. */
export interface LeadToJudgeRow {
  id: number;
  lead: string;
  path: string;
  start_line: number;
  start_column: number;
}

/** Un lot de jugement, tel que `saveBatchUsage` l'écrit dans `usage`. */
export interface BatchUsageRecord {
  runId: string;
  sinkType: string;
  phase: string;
  batch: number;
  usage: Usage;
}

/** Tokens et coût d'un ensemble de lots. */
export interface UsageTotals {
  batches: number;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  total: number;
  cost: number;
}

/** Un lancement : ses lots cumulés, la période couverte, ses phases et ses classes. */
export interface RunUsage extends UsageTotals {
  run_id: string;
  started_at: number;
  ended_at: number;
  phases: string[];
  classes: string[];
}

/** Totaux de tous les lancements, avec la période couverte (`null` quand `usage` est vide). */
export interface UsageSummary extends UsageTotals {
  runs: number;
  first_run: number | null;
  last_run: number | null;
}

/** Coût cumulé d'une classe pour une phase, tous lancements confondus. */
export interface ClassUsage extends UsageTotals {
  sink_type: string;
  phase: string;
  updated_at: number;
}

/** Tokens d'une phase, tous lancements confondus. */
export interface PhaseUsage {
  input: number;
  output: number;
  cache_read: number;
  total: number;
}

/** Tout l'usage de la base : global, par lancement, par classe et par phase. */
export interface UsageReport {
  summary: UsageSummary;
  runs: RunUsage[];
  byClass: ClassUsage[];
  byPhase: Record<string, PhaseUsage>;
}

/** Filtres de la liste des fichiers scannés. */
export interface FileFilters {
  status?: FileStatus;
  q?: string;
  limit?: number;
  offset?: number;
}

/** Un fichier scanné, avec le nombre de matches et de leads qu'il porte. */
export interface FileRow {
  id: number;
  path: string;
  sha256: string;
  status: FileStatus;
  error: string | null;
  scanned_at: number;
  matches: number;
  leads: number;
}

/** Filtres de la liste des matches. */
export interface MatchFilters {
  fileId?: number;
  analyzer?: string;
  limit?: number;
  offset?: number;
}

/** Un match d'analyzer, avec son fichier et le nombre de leads qu'il a produits. */
export interface MatchRow {
  id: number;
  file_id: number;
  file: string;
  analyzer: string;
  value: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  leads: number;
}

/** Où vit la base du projet courant. */
export interface ProjectInfo {
  root: string;
  dbPath: string;
}
