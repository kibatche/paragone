/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc queue.ts — Lectures de la file de triage du front (filtres, masques, priorité, espérance du grade
 *       de Jev, compteurs) et revue humaine d'un lead.
 */

import { type SQLQueryBindings } from "bun:sqlite";
import type { Lead } from "../analyze/constants/lead";
import {
  CARRIER_PREVIEW_CHARS,
  EXPECTATION,
  GROUP_RANK,
  JUDGEMENTS_JSON,
  LEAD_JOINS,
  PRIORITY,
  QUEUE_MASKS,
  QUEUE_VERDICT_ORDER,
  REJECTED_RANK,
} from "./constants";
import { getDatabase, readCount, withContext } from "./db";
import type {
  Breakdown,
  Judgement,
  LeadDetail,
  LeadLocation,
  ListFilters,
  ListRow,
  QueueCount,
  Summary,
} from "./types";

type Bindings = Record<string, string | number | null>;

/** @brief Clauses des masques par défaut, chacune levée par son `show*` ou un filtre explicite. */
function maskClauses(filters: ListFilters): string[] {
  const where: string[] = [];
  if (!filters.showInventory && !filters.kind) where.push("l.kind = 'impact'");
  if (!filters.showDuplicates) where.push("l.duplicate_of IS NULL");
  if (!filters.showLiteral && filters.verdict !== "LITERAL_ONLY")
    where.push("(l.verdict IS NULL OR l.verdict != 'LITERAL_ONLY')");
  if (!filters.showRejected && filters.score !== "REJECT")
    where.push(`${PRIORITY} != ${REJECTED_RANK}`);
  if (!filters.showReviewed && !filters.humanScore)
    where.push("l.reviewed_at IS NULL");
  return where;
}

/** @brief WHERE de la file ; les valeurs passent toujours par des paramètres nommés. */
function buildQueueWhere(filters: ListFilters): {
  where: string[];
  args: Bindings;
} {
  const where = maskClauses(filters);
  const args: Bindings = { $cls: filters.cls ?? null };
  if (filters.cls)
    where.push(
      "EXISTS (SELECT 1 FROM json_each(l.classes) c WHERE c.value = $cls)",
    );
  if (filters.kind) {
    where.push("l.kind = $kind");
    args.$kind = filters.kind;
  }
  if (filters.verdict) {
    where.push("l.verdict = $verdict");
    args.$verdict = filters.verdict;
  }
  if (filters.score) {
    where.push(
      "EXISTS (SELECT 1 FROM judgements j WHERE j.lead_id = l.id AND j.score = $score AND ($cls IS NULL OR j.class = $cls))",
    );
    args.$score = filters.score;
  }
  if (filters.analyzer) {
    where.push("json_extract(l.lead, '$.analyzerName') = $analyzer");
    args.$analyzer = filters.analyzer;
  }
  if (filters.humanScore) {
    where.push("l.human_score = $human");
    args.$human = filters.humanScore;
  }
  if (filters.unjudged)
    where.push(
      "l.kind = 'impact' AND NOT EXISTS (SELECT 1 FROM judgements j WHERE j.lead_id = l.id AND ($cls IS NULL OR j.class = $cls))",
    );
  if (filters.duplicateOf !== undefined) {
    where.push("l.duplicate_of = $duplicateOf");
    args.$duplicateOf = filters.duplicateOf;
  }
  if (filters.q) {
    where.push(
      "(l.reconstructed LIKE $q OR f.path LIKE $q OR m.value LIKE $q)",
    );
    args.$q = `%${filters.q}%`;
  }
  return { where, args };
}

function whereClause(where: string[]): string {
  return where.length ? ` WHERE ${where.join(" AND ")}` : "";
}

function countQueueWith(filters: ListFilters): number {
  const { where, args } = buildQueueWhere(filters);
  return readCount(
    getDatabase(),
    `SELECT count(*) AS count ${LEAD_JOINS}${whereClause(where)}`,
    args,
  );
}

function readBreakdown(sql: string): Breakdown[] {
  return getDatabase().query<Breakdown, []>(sql).all();
}

/** @brief Compteurs globaux et répartitions par classe, verdict, score de Jev, statut de fichier, analyzer. */
export function summary(): Summary {
  return withContext("summary", undefined, () => {
    const totals = getDatabase()
      .query<Summary["totals"], []>(
        `SELECT count(*) total,
           (SELECT count(DISTINCT lead_id) FROM judgements) agent_judged,
           coalesce(sum(reviewed_at IS NOT NULL), 0) human_reviewed
         FROM leads`,
      )
      .get();
    if (!totals) throw new Error("aucune ligne de compteurs");
    return {
      totals,
      byClass: readBreakdown(
        `SELECT c.value k, count(*) n FROM leads l, json_each(l.classes) c
         GROUP BY c.value ORDER BY n DESC`,
      ),
      byVerdict: readBreakdown(
        "SELECT verdict k, count(*) n FROM leads WHERE verdict IS NOT NULL GROUP BY verdict ORDER BY n DESC",
      ),
      byAgentScore: readBreakdown(
        "SELECT score k, count(*) n FROM judgements GROUP BY score ORDER BY n DESC",
      ),
      byFileStatus: readBreakdown(
        "SELECT status k, count(*) n FROM files GROUP BY status ORDER BY n DESC",
      ),
      byAnalyzer: readBreakdown(
        `SELECT json_extract(lead, '$.analyzerName') k, count(*) n FROM leads
         GROUP BY k ORDER BY n DESC`,
      ),
    };
  });
}

/**
 * @brief File de triage filtrée, les leads les plus prometteurs en tête : groupe (jugé, non jugé,
 *        rejeté), puis espérance du grade de Jev, puis verdict de taint, puis id.
 */
export function listLeads(filters: ListFilters = {}): ListRow[] {
  return withContext("listLeads", undefined, () => {
    const { where, args } = buildQueueWhere(filters);
    const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
    const offset = Math.max(filters.offset ?? 0, 0);
    const rows = getDatabase()
      .query<
        Omit<ListRow, "classes" | "judgements"> & {
          classes: string;
          judgements: string;
        },
        SQLQueryBindings[]
      >(
        `SELECT l.id, l.duplicate_of, l.kind, l.classes, l.reconstructed, l.verdict,
           m.analyzer, json_extract(l.lead, '$.analyzerName') analyzer_name,
           json_extract(l.lead, '$.request.method') method,
           substr(json_extract(l.lead, '$.taint.sink.carrierText'), 1, ${CARRIER_PREVIEW_CHARS}) carrier,
           f.path file, m.start_line line, ${PRIORITY} priority, ${EXPECTATION} expectation,
           ${JUDGEMENTS_JSON} judgements, l.human_score, l.reviewed_at ${LEAD_JOINS}` +
          whereClause(where) +
          ` ORDER BY ${GROUP_RANK}, expectation DESC, ${QUEUE_VERDICT_ORDER}, l.id LIMIT $limit OFFSET $offset`,
      )
      .all({ ...args, $limit: limit, $offset: offset });
    return rows.map((row) => ({
      ...row,
      classes: JSON.parse(row.classes) as string[],
      judgements: JSON.parse(row.judgements) as Judgement[],
    }));
  });
}

/** @brief Taille de la file et, pour chaque masque encore posé, combien de leads il cache en plus. */
export function countQueue(filters: ListFilters = {}): QueueCount {
  return withContext("countQueue", undefined, () => {
    const total = countQueueWith(filters);
    const hidden: QueueCount["hidden"] = {};
    for (const mask of QUEUE_MASKS) {
      if (filters[mask]) continue;
      hidden[mask] = countQueueWith({ ...filters, [mask]: true }) - total;
    }
    return { total, hidden };
  });
}

/** @brief Fichier et ligne d'un lead, sans le reste : de quoi ouvrir le viewer de source. */
export function getLeadLocation(id: number): LeadLocation | null {
  return withContext("getLeadLocation", `lead ${id}`, () => {
    const row = getDatabase()
      .query<
        LeadLocation,
        [number]
      >(`SELECT f.path file, m.start_line line ${LEAD_JOINS} WHERE l.id = ?`)
      .get(id);
    return row ?? null;
  });
}

type LeadDetailRow = Omit<LeadDetail, "classes" | "judgements" | "lead"> & {
  classes: string;
  judgements: string;
  lead: string;
};

/** @brief Détail d'un lead : son match, son fichier, ses jugements, ses doublons, et le Lead décodé. */
export function getLead(id: number): LeadDetail | null {
  return withContext("getLead", `lead ${id}`, () => {
    const row = getDatabase()
      .query<LeadDetailRow, [number]>(
        `SELECT l.id, l.duplicate_of, l.kind, l.classes, l.reconstructed, l.pattern, l.verdict,
           l.lead, l.human_score, l.human_note, l.reviewed_at, m.analyzer, m.value match_text,
           m.start_line line, m.start_column column, f.path file, ${JUDGEMENTS_JSON} judgements,
           (SELECT count(*) FROM leads d WHERE d.duplicate_of = l.id) duplicates
         ${LEAD_JOINS} WHERE l.id = ?`,
      )
      .get(id);
    if (!row) return null;
    return {
      ...row,
      classes: JSON.parse(row.classes) as string[],
      judgements: JSON.parse(row.judgements) as Judgement[],
      lead: JSON.parse(row.lead) as Lead,
    };
  });
}

/** @brief Tous les masques de la file sont levés : un doublon est caché par défaut. */
export function listDuplicates(id: number): ListRow[] {
  return listLeads({
    duplicateOf: id,
    showInventory: true,
    showDuplicates: true,
    showLiteral: true,
    showRejected: true,
    showReviewed: true,
  });
}

/** @brief Enregistre ou remplace la revue humaine d'un lead. @return false si le lead n'existe pas. */
export function setHumanReview(
  id: number,
  score: string,
  note: string,
): boolean {
  return withContext("setHumanReview", `lead ${id}`, () => {
    const result = getDatabase()
      .query<
        null,
        SQLQueryBindings[]
      >("UPDATE leads SET human_score = ?, human_note = ?, reviewed_at = ? WHERE id = ?")
      .run(score, note, Date.now(), id);
    return result.changes > 0;
  });
}

/** @brief Efface la revue humaine d'un lead. @return false si le lead n'existe pas. */
export function clearHumanReview(id: number): boolean {
  return withContext("clearHumanReview", `lead ${id}`, () => {
    const result = getDatabase()
      .query<
        null,
        SQLQueryBindings[]
      >("UPDATE leads SET human_score = NULL, human_note = NULL, reviewed_at = NULL WHERE id = ?")
      .run(id);
    return result.changes > 0;
  });
}
