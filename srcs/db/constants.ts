/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc constants.ts : classes jugeables, telles que la CLI, la config et le front les connaissent,
 *       états d'un fichier scanné, schéma, et fragments SQL partagés du juge et de la file de triage.
 */
import { IMPACT_CLASSES } from "../analyze/constants/lead";

export const VALID_SINK_TYPES = new Set<string>(IMPACT_CLASSES);

/**
 * État d'un fichier dans `files` : `ok` analysé, `not_js` contenu balisé (HTML) écarté sans
 * analyse, `parse_error` rejeté par le parseur.
 */
export const FILE_STATUSES = ["ok", "not_js", "parse_error"] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const SCHEMA = [
  //files
  `CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    scanned_at INTEGER NOT NULL
  ) STRICT`,

  // matches
  `CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    analyzer TEXT NOT NULL,
    value TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    start_column INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    end_column INTEGER NOT NULL,
    UNIQUE (file_id, analyzer, start_line, start_column)
  ) STRICT`,

  // leads
  `CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    kind TEXT NOT NULL,
    classes TEXT NOT NULL,
    dedup_key TEXT NOT NULL,
    dedup_version INTEGER NOT NULL,
    reconstructed TEXT NOT NULL,
    pattern TEXT,
    verdict TEXT,
    lead TEXT NOT NULL,
    duplicate_of INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    human_score TEXT,
    human_note TEXT,
    reviewed_at INTEGER,
    UNIQUE (match_id, ordinal)
  ) STRICT`,

  // leads_dedup
  `CREATE INDEX IF NOT EXISTS leads_dedup ON leads (dedup_key, dedup_version)`,

  //judgements
  `CREATE TABLE IF NOT EXISTS judgements (
    lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    class TEXT NOT NULL,
    score TEXT NOT NULL,
    note TEXT NOT NULL,
    reject_reason TEXT,
    judged_at INTEGER NOT NULL,
    PRIMARY KEY (lead_id, class)
  ) STRICT`,

  // usage
  `CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY,
    run_id TEXT NOT NULL,
    sink_type TEXT NOT NULL,
    phase TEXT NOT NULL,
    batch INTEGER NOT NULL,
    input INTEGER NOT NULL,
    output INTEGER NOT NULL,
    cache_read INTEGER NOT NULL,
    cache_write INTEGER NOT NULL,
    total INTEGER NOT NULL,
    cost REAL NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT`,

  // usage_run
  `CREATE INDEX IF NOT EXISTS usage_run ON usage (run_id)`,
];

/**
 * Leads jugeables pour la classe `$cls` : d'impact, canoniques, porteurs de la classe, et dont le
 * taint n'est pas entièrement littéral. La table `leads` y porte l'alias `l`.
 */
export const JUDGEABLE_LEADS = `l.kind = 'impact' AND l.duplicate_of IS NULL
  AND (l.verdict IS NULL OR l.verdict != 'LITERAL_ONLY')
  AND EXISTS (SELECT 1 FROM json_each(l.classes) c WHERE c.value = $cls)`;

/** Le lead `l` n'a pas encore de jugement pour la classe `$cls`. */
export const NOT_JUDGED = `NOT EXISTS (SELECT 1 FROM judgements j WHERE j.lead_id = l.id AND j.class = $cls)`;

/** Tri des leads à juger : ceux dont le taint atteint une source d'abord. */
export const VERDICT_ORDER = `CASE l.verdict WHEN 'SOURCE_REACHED' THEN 0 WHEN 'MIXED' THEN 1
  WHEN 'NAMED_BOUNDARY' THEN 2 WHEN 'INCOMPLETE' THEN 3 ELSE 4 END`;

/**
 * Colonnes ajoutées après la création de la table : une base existante les reçoit par
 * `ALTER TABLE`, une base neuve aussi. Seul endroit où elles sont déclarées.
 */
export const ADDED_COLUMNS: { table: string; column: string; type: string }[] =
  [
    { table: "judgements", column: "confidence", type: "REAL" },
    { table: "judgements", column: "probabilities", type: "TEXT" },
    { table: "judgements", column: "model", type: "TEXT" },
  ];

/** Les masques de file, dans l'ordre où le front les propose. */
export const QUEUE_MASKS = [
  "showInventory",
  "showDuplicates",
  "showLiteral",
  "showRejected",
  "showReviewed",
] as const;
export type QueueMask = (typeof QUEUE_MASKS)[number];

/** Verdicts humains acceptés ; un score vide reste permis (note seule). */
export const HUMAN_SCORES = [
  "LEAD",
  "REJECT",
  "ESCALATE",
  "CONFIRMED",
  "DORMANT",
  "INFO",
] as const;

/** Rang de priorité d'un lead non jugé : entre IN_DEPTH et REJECT. */
export const UNJUDGED_RANK = 3;
export const REJECTED_RANK = 4;

/**
 * Poids de chaque grade de Jev dans l'espérance d'un jugement : Σ poids · P(grade). L'échelle suit
 * l'ordre des grades ; REJECT ne compte pas.
 */
export const SCORE_WEIGHTS: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  IN_DEPTH: 1,
  REJECT: 0,
};

/** Caractères du porteur renvoyés par ligne de file : de quoi reconnaître l'appel, pas plus. */
export const CARRIER_PREVIEW_CHARS = 160;

/** Un lead avec son match et son fichier ; les tables portent les alias `l`, `m` et `f`. */
export const LEAD_JOINS = `FROM leads l JOIN matches m ON m.id = l.match_id JOIN files f ON f.id = m.file_id`;

/**
 * Meilleur score de Jev du lead, en rang : HIGH 0, MEDIUM 1, IN_DEPTH 2, non jugé 3, REJECT 4.
 * Restreint à la classe filtrée quand il y en a une (`$cls` vaut alors NULL sinon).
 */
export const PRIORITY = `coalesce((SELECT min(CASE j.score
    WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1
    WHEN 'IN_DEPTH' THEN 2 WHEN 'IN_DEPTH_INSPECTION_REQUIRED' THEN 2
    ELSE ${REJECTED_RANK} END)
  FROM judgements j WHERE j.lead_id = l.id AND ($cls IS NULL OR j.class = $cls)), ${UNJUDGED_RANK})`;

/**
 * Groupe de tri : jugés non rejetés, puis non jugés, puis rejetés. L'espérance ne départage qu'au
 * sein d'un groupe, un rejet reste donc derrière un lead non jugé.
 */
export const GROUP_RANK = `CASE priority WHEN ${REJECTED_RANK} THEN 2 WHEN ${UNJUDGED_RANK} THEN 1 ELSE 0 END`;

/** Ordre des verdicts de taint à priorité de Jev égale dans la file : la source atteinte d'abord. */
export const QUEUE_VERDICT_ORDER = `CASE l.verdict WHEN 'SOURCE_REACHED' THEN 0 WHEN 'MIXED' THEN 1
  WHEN 'NAMED_BOUNDARY' THEN 2 WHEN 'INCOMPLETE' THEN 3 WHEN 'OPAQUE' THEN 4 ELSE 5 END`;

/** Sous-requête qui agrège en JSON les jugements du lead `l`. */
export const JUDGEMENTS_JSON = `(SELECT json_group_array(json_object(
    'class', j.class, 'score', j.score, 'note', j.note, 'reject_reason', j.reject_reason,
    'confidence', j.confidence, 'probabilities', json(j.probabilities), 'model', j.model,
    'judged_at', j.judged_at))
  FROM judgements j WHERE j.lead_id = l.id)`;

function scoreWeightSql(): string {
  const cases = Object.entries(SCORE_WEIGHTS)
    .map(([score, weight]) => `WHEN '${score}' THEN ${weight}`)
    .join(" ");
  return `CASE j.score ${cases} ELSE 0 END`;
}

function weightedProbabilitiesSql(): string {
  return Object.entries(SCORE_WEIGHTS)
    .filter(([, weight]) => weight > 0)
    .map(
      ([score, weight]) =>
        `${weight} * coalesce(json_extract(j.probabilities, '$.${score}'), 0)`,
    )
    .join(" + ");
}

/**
 * Espérance du grade de Jev pour le lead `l` : la meilleure sur ses jugements, restreinte à la
 * classe filtrée quand il y en a une. NULL pour un lead non jugé. Un jugement sans probabilités
 * vaut le poids de son score.
 */
export const EXPECTATION = `(SELECT max(CASE WHEN j.probabilities IS NULL THEN ${scoreWeightSql()}
    ELSE ${weightedProbabilitiesSql()} END)
  FROM judgements j WHERE j.lead_id = l.id AND ($cls IS NULL OR j.class = $cls))`;
