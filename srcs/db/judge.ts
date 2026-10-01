/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc judge.ts — Lectures et écritures du juge Jev dans findings.db : leads à juger d'une classe,
 *       compteurs de progression, enregistrement et remise à zéro des jugements.
 */

import { type SQLQueryBindings } from "bun:sqlite";
import type { Lead } from "../analyze/constants/lead";
import { JUDGEABLE_LEADS, NOT_JUDGED, VERDICT_ORDER } from "./constants";
import { getDatabase, readCount, withContext } from "./db";
import type { JudgementRecord, LeadToJudge, LeadToJudgeRow } from "./types";

function toLeadToJudge(row: LeadToJudgeRow): LeadToJudge {
  return {
    id: row.id,
    filePath: row.path,
    line: row.start_line,
    column: row.start_column,
    lead: JSON.parse(row.lead) as Lead,
  };
}

/** @brief Leads jugeables d'une classe qui n'ont pas encore de jugement pour elle, sources en tête. */
export function listLeadsToJudge(cls: string): LeadToJudge[] {
  const rows = getDatabase()
    .query<LeadToJudgeRow, [{ $cls: string }]>(
      `SELECT l.id, l.lead, f.path, m.start_line, m.start_column
       FROM leads l JOIN matches m ON m.id = l.match_id JOIN files f ON f.id = m.file_id
       WHERE ${JUDGEABLE_LEADS} AND ${NOT_JUDGED}
       ORDER BY ${VERDICT_ORDER}, l.id`,
    )
    .all({ $cls: cls });
  return rows.map(toLeadToJudge);
}

/** @brief Nombre de leads jugeables d'une classe. */
export function countJudgeableLeads(cls: string): number {
  return readCount(
    getDatabase(),
    `SELECT count(*) AS count FROM leads l WHERE ${JUDGEABLE_LEADS}`,
    { $cls: cls },
  );
}

/** @brief Nombre de leads jugeables d'une classe encore sans jugement pour elle. */
export function countRemainingJudge(cls: string): number {
  return readCount(
    getDatabase(),
    `SELECT count(*) AS count FROM leads l WHERE ${JUDGEABLE_LEADS} AND ${NOT_JUDGED}`,
    { $cls: cls },
  );
}

/** @brief Parmi `ids`, ceux qui n'ont pas de jugement pour `cls`. */
export function listUnjudgedIds(ids: number[], cls: string): number[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDatabase()
    .query<{ id: number }, SQLQueryBindings[]>(
      `SELECT l.id FROM leads l WHERE l.id IN (${placeholders})
       AND NOT EXISTS (SELECT 1 FROM judgements j WHERE j.lead_id = l.id AND j.class = ?)`,
    )
    .all(...ids, cls);
  return rows.map((row) => row.id);
}

/**
 * @brief Écrit le verdict d'un lead pour une classe ; un nouveau verdict remplace l'ancien.
 *        `note` reste vide : un juge de décision ne rédige pas, il rend une distribution.
 */
export function saveJudgement(record: JudgementRecord): void {
  withContext("saveJudgement", `lead ${record.leadId}, ${record.cls}`, () =>
    getDatabase()
      .query<null, SQLQueryBindings[]>(
        `INSERT INTO judgements (lead_id, class, score, note, reject_reason, confidence, probabilities,
             model, judged_at)
           VALUES (?, ?, ?, '', ?, ?, ?, ?, ?)
           ON CONFLICT(lead_id, class) DO UPDATE SET score = excluded.score, note = excluded.note,
             reject_reason = excluded.reject_reason, confidence = excluded.confidence,
             probabilities = excluded.probabilities, model = excluded.model, judged_at = excluded.judged_at`,
      )
      .run(
        record.leadId,
        record.cls,
        record.score,
        record.rejectReason ?? null,
        record.confidence,
        JSON.stringify(record.probabilities),
        record.model,
        Date.now(),
      ),
  );
}

/** @brief Supprime les jugements d'une classe ; renvoie leur nombre. */
export function resetJudgements(cls: string): number {
  return getDatabase()
    .query<null, [string]>("DELETE FROM judgements WHERE class = ?")
    .run(cls).changes;
}
