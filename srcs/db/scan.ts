/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc scan.ts : Écritures du scan dans findings.db : fichiers, matches et leads, dans une transaction par
 *       fichier, et la lecture de l'empreinte qui rend le scan incrémental.
 */

import { Database, type SQLQueryBindings } from "bun:sqlite";
import {
  DEDUP_KEY_VERSION,
  leadKind,
  type Lead,
} from "../analyze/constants/lead";
import type { AnalyzerMatch } from "../analyze/constants/types";
import { dedupKey } from "../analyze/taint/taint_report";
import { getDatabase, readCount, withContext } from "./db";
import type {
  FileFilters,
  FileRow,
  FileScan,
  MatchFilters,
  MatchRow,
} from "./types";

/** @brief Empreinte enregistrée d'un fichier, ou undefined s'il n'a jamais été scanné. */
export function getFileSha256(path: string): string | undefined {
  const row = getDatabase()
    .query<{ sha256: string }, [string]>(
      "SELECT sha256 FROM files WHERE path = ?",
    )
    .get(path);
  return row?.sha256;
}

/** @brief Nombre de lignes d'une des tables du modèle. */
export function countRows(
  table: "files" | "matches" | "leads" | "judgements",
): number {
  return readCount(getDatabase(), `SELECT count(*) AS count FROM ${table}`);
}

/** @brief Id du fichier (inséré, ou mis à jour s'il était déjà scanné). */
function writeFile(database: Database, scan: FileScan): number {
  const row = database
    .query<{ id: number }, SQLQueryBindings[]>(
      `INSERT INTO files (path, sha256, status, error, scanned_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET sha256 = excluded.sha256, status = excluded.status,
         error = excluded.error, scanned_at = excluded.scanned_at
       RETURNING id`,
    )
    .get(scan.path, scan.sha256, scan.status, scan.error ?? null, Date.now());
  if (!row) throw new Error(`Error [writeFile]: aucun id pour ${scan.path}`);
  return row.id;
}

/** @brief Id du match (inséré, ou déjà présent à la même position). */
function writeMatch(
  database: Database,
  fileId: number,
  match: AnalyzerMatch,
): number {
  database
    .query<null, SQLQueryBindings[]>(
      `INSERT INTO matches (file_id, analyzer, value, start_line, start_column, end_line, end_column)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(file_id, analyzer, start_line, start_column) DO NOTHING`,
    )
    .run(
      fileId,
      match.analyzerName,
      match.value,
      match.start.line,
      match.start.column,
      match.end.line,
      match.end.column,
    );
  const row = database
    .query<{ id: number }, SQLQueryBindings[]>(
      "SELECT id FROM matches WHERE file_id = ? AND analyzer = ? AND start_line = ? AND start_column = ?",
    )
    .get(fileId, match.analyzerName, match.start.line, match.start.column);
  if (!row) {
    throw new Error(
      `Error [writeMatch]: match introuvable après insertion, ligne ${match.start.line}`,
    );
  }
  return row.id;
}

/**
 * @brief Insère un lead. Un lead dont la clé de dédup existe déjà pointe `duplicate_of` vers le
 *        premier lead canonique de cette clé.
 * @return 1 si le lead a été inséré, 0 s'il existait déjà à cette place.
 */
function writeLead(
  database: Database,
  matchId: number,
  ordinal: number,
  lead: Lead,
  carrierText: string,
): number {
  const key = dedupKey(lead, carrierText);
  const canonical = database
    .query<{ id: number }, SQLQueryBindings[]>(
      `SELECT id FROM leads WHERE dedup_key = ? AND dedup_version = ?
       AND duplicate_of IS NULL ORDER BY id LIMIT 1`,
    )
    .get(key, DEDUP_KEY_VERSION);
  const result = database
    .query<null, SQLQueryBindings[]>(
      `INSERT INTO leads (match_id, ordinal, kind, classes, dedup_key, dedup_version, reconstructed,
         pattern, verdict, lead, duplicate_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(match_id, ordinal) DO NOTHING`,
    )
    .run(
      matchId,
      ordinal,
      leadKind(lead.class),
      JSON.stringify(lead.class),
      key,
      DEDUP_KEY_VERSION,
      lead.reconstructed,
      lead.taint?.sink?.pattern ?? null,
      lead.taint?.verdict ?? null,
      JSON.stringify(lead),
      canonical?.id ?? null,
    );
  return result.changes;
}

/** @brief Insère les leads d'un match ; renvoie le nombre de leads ajoutés. */
function writeLeads(
  database: Database,
  matchId: number,
  match: AnalyzerMatch,
): number {
  let added = 0;
  for (const [ordinal, lead] of (match.leads ?? []).entries()) {
    added += writeLead(database, matchId, ordinal, lead, match.value);
  }
  return added;
}

/**
 * @brief Écrit un fichier scanné, ses matches et leurs leads, dans une seule transaction.
 *        Idempotent : un match ou un lead déjà présent à la même place n'est pas réécrit.
 * @return Nombre de leads ajoutés.
 */
export function saveFileScan(scan: FileScan): number {
  const database = getDatabase();
  const writeAll = database.transaction((): number => {
    const fileId = writeFile(database, scan);
    let added = 0;
    for (const match of scan.matches) {
      const matchId = writeMatch(database, fileId, match);
      added += writeLeads(database, matchId, match);
    }
    return added;
  });
  return withContext("saveFileScan", scan.path, writeAll);
}

type Bindings = Record<string, string | number | null>;

/** @brief Borne une pagination : 200 par défaut, entre 1 et 1000. */
function pageOf(
  limit: number | undefined,
  offset: number | undefined,
): Bindings {
  return {
    $limit: Math.min(Math.max(limit ?? 200, 1), 1000),
    $offset: Math.max(offset ?? 0, 0),
  };
}

function whereClause(where: string[]): string {
  return where.length ? ` WHERE ${where.join(" AND ")}` : "";
}

function fileWhere(filters: FileFilters): { where: string[]; args: Bindings } {
  const where: string[] = [];
  const args: Bindings = {};
  if (filters.status) {
    where.push("f.status = $status");
    args.$status = filters.status;
  }
  if (filters.q) {
    where.push("f.path LIKE $q");
    args.$q = `%${filters.q}%`;
  }
  return { where, args };
}

/** @brief Fichiers scannés, par chemin, avec le nombre de matches et de leads de chacun. */
export function listFiles(filters: FileFilters = {}): FileRow[] {
  return withContext("listFiles", undefined, () => {
    const { where, args } = fileWhere(filters);
    return getDatabase()
      .query<FileRow, SQLQueryBindings[]>(
        `SELECT f.id, f.path, f.sha256, f.status, f.error, f.scanned_at,
           (SELECT count(*) FROM matches m WHERE m.file_id = f.id) matches,
           (SELECT count(*) FROM leads l JOIN matches m ON m.id = l.match_id WHERE m.file_id = f.id) leads
         FROM files f${whereClause(where)} ORDER BY f.path LIMIT $limit OFFSET $offset`,
      )
      .all({ ...args, ...pageOf(filters.limit, filters.offset) });
  });
}

/** @brief Nombre de fichiers qui passent les filtres, sans pagination. */
export function countFiles(filters: FileFilters = {}): number {
  return withContext("countFiles", undefined, () => {
    const { where, args } = fileWhere(filters);
    return readCount(
      getDatabase(),
      `SELECT count(*) AS count FROM files f${whereClause(where)}`,
      args,
    );
  });
}

function matchWhere(filters: MatchFilters): {
  where: string[];
  args: Bindings;
} {
  const where: string[] = [];
  const args: Bindings = {};
  if (filters.fileId !== undefined) {
    where.push("m.file_id = $fileId");
    args.$fileId = filters.fileId;
  }
  if (filters.analyzer) {
    where.push("m.analyzer = $analyzer");
    args.$analyzer = filters.analyzer;
  }
  return { where, args };
}

/** @brief Matches d'analyzers, par fichier puis par position, avec le nombre de leads de chacun. */
export function listMatches(filters: MatchFilters = {}): MatchRow[] {
  return withContext("listMatches", undefined, () => {
    const { where, args } = matchWhere(filters);
    return getDatabase()
      .query<MatchRow, SQLQueryBindings[]>(
        `SELECT m.id, m.file_id, f.path file, m.analyzer, m.value, m.start_line, m.start_column,
           m.end_line, m.end_column,
           (SELECT count(*) FROM leads l WHERE l.match_id = m.id) leads
         FROM matches m JOIN files f ON f.id = m.file_id${whereClause(where)}
         ORDER BY f.path, m.start_line, m.start_column, m.id LIMIT $limit OFFSET $offset`,
      )
      .all({ ...args, ...pageOf(filters.limit, filters.offset) });
  });
}

/** @brief Nombre de matches qui passent les filtres, sans pagination. */
export function countMatches(filters: MatchFilters = {}): number {
  return withContext("countMatches", undefined, () => {
    const { where, args } = matchWhere(filters);
    return readCount(
      getDatabase(),
      `SELECT count(*) AS count FROM matches m${whereClause(where)}`,
      args,
    );
  });
}
