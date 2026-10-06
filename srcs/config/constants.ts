/**
 * @desc Constantes pour le parsing d'argument.
 */

import { join } from "node:path";


export const DEFAULT_PROJECT_DIR = process.cwd();

export const PARAGONE_DIR_NAME = ".paragone";
export const PARAGONE_CONFIG_NAME = "paragone_config.json";
export const PARAGONE_DB_NAME = "findings.db";
export const PARAGONE_DB_SHM_NAME = "findings.db-shm";
export const PARAGONE_DB_WAL_PATH_NAME = "findings.db-wal";
export const PARAGONE_LOG_TXT_NAME = "log.txt";
export const PARAGONE_LOG_JSONL_NAME = "events.jsonl";

export const DEFAULT_BATCH = 1;

/** Port d'écoute par défaut de l'API ; l'hôte par défaut est local. */
export const DEFAULT_SERVE_PORT = 7331;
export const DEFAULT_SERVE_HOST = "127.0.0.1";
export const DEFAULT_PUBLIC_DIR = join(import.meta.path, '../../api/public')

export const SERVER_OPTIONS = ["host", "port", "cors", "public"];

export const LOOPBACK_HOSTS: readonly string[] = [
  "127.0.0.1",
  "localhost",
  "::1",
];

export const API_PREFIX = "/api";

/** Version du contrat OpenAPI publié. */
export const API_VERSION = "0.1.0";