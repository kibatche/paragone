/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc db.ts : utilitaires liés à la base de données.
 */

import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ADDED_COLUMNS, SCHEMA } from "./constants";
import type { ProjectInfo } from "./types";
import { config } from "../config/config";

/** @brief Relance `action` en nommant la fonction et l'objet en cause, l'erreur d'origine en `cause`. */
export function withContext<T>(
  where: string,
  detail: string | undefined,
  action: () => T,
): T {
  try {
    return action();
  } catch (error) {
    const suffix = detail === undefined ? "" : `: ${detail}`;
    throw new Error(`Error [${where}]${suffix}`, { cause: error });
  }
}

function configureConnection(database: Database): void {
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA busy_timeout = 5000");
  database.run("PRAGMA foreign_keys = ON");
}

function createSchema(database: Database): void {
  for (const statement of SCHEMA) {
    withContext("schema", statement.split("(")[0], () =>
      database.run(statement),
    );
  }
}

/** @brief Ajoute à une table existante les colonnes de `ADDED_COLUMNS` qui lui manquent. */
function addMissingColumns(database: Database): void {
  for (const { table, column, type } of ADDED_COLUMNS) {
    const columns = database
      .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
      .all();
    if (columns.some((c) => c.name === column)) continue;
    database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

/** @brief Ouvre la base, la crée avec son dossier si besoin, et la met au schéma courant. */
function openDatabase(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path, { readwrite: true, create: true });
  configureConnection(database);
  createSchema(database);
  addMissingColumns(database);
  return database;
}

let connection: Database | undefined;

/** @brief La connexion du process, ouverte au premier appel. */
export function getDatabase(): Database {
  connection ??= openDatabase(config.paragone_db_file);
  return connection;
}

export function getProjectInfo(): ProjectInfo {
  return {
    root: config.paragone_project_path,
    dbPath: config.paragone_db_file,
  };
}

/** @brief Ouvre la base maintenant, pour la créer et la mettre au schéma avant le premier appel utile. */
export function initDatabase(): void {
  getDatabase();
}

/** @brief Valeur de la colonne `count` de la requête ; la requête doit renvoyer une ligne. */
export function readCount(
  database: Database,
  sql: string,
  ...params: SQLQueryBindings[]
): number {
  const row = database
    .query<{ count: number }, SQLQueryBindings[]>(sql)
    .get(...params);
  if (!row) throw new Error(`Error [readCount]: aucune ligne pour ${sql}`);
  return row.count;
}
