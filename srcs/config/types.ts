import { basename, join } from "node:path";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import * as z from "zod";
import {
  PARAGONE_CONFIG_NAME,
  PARAGONE_DB_NAME,
  PARAGONE_DB_SHM_NAME,
  PARAGONE_DB_WAL_PATH_NAME,
  PARAGONE_DIR_NAME,
  PARAGONE_LOG_JSONL_NAME,
  PARAGONE_LOG_TXT_NAME,
} from "./constants";

export interface ProjectConfig {
  project: string; // emplacement du projet
  project_name: string; // défaut = nom du dossier racine
  paragone_dir: string;
  paragone_config: string;
  paragone_db: string;
  paragone_shm: string;
  paragone_wal: string;
  paragone_log: string;
  paragone_jsonl: string;
  analyze: string; // dossier de JS à scanner
  classes: string[]; // classe(s) à juger
  scan: boolean; // lancer un scan
  judge: boolean; // lancer le juge
  reset: boolean; // refaire le scan et/ou l'analyse
  noninteractive: boolean; // mode non-interactif
  batch: number; // taille des lots
  serve: boolean; // lancer l'API
  port: number; // port d'écoute de l'API
  host: string; // adresse d'écoute de l'API
  cors: string[]; // origines autorisées à appeler l'API depuis un autre site
  public?: string; // dossier servi à la racine de l'API
}

export const defaultConfig: Pick<
  ProjectConfig,
  | "project"
  | "project_name"
  | "paragone_dir"
  | "paragone_config"
  | "paragone_db"
  | "paragone_shm"
  | "paragone_wal"
  | "paragone_log"
  | "paragone_jsonl"
  | "analyze"
  | "classes"
  | "scan"
  | "judge"
  | "reset"
  | "noninteractive"
  | "batch"
  | "serve"
  | "port"
  | "host"
  | "cors"
  | "public"
> = {
  project: process.cwd(),
  project_name: basename(process.cwd()),
  paragone_dir: join(process.cwd(), PARAGONE_DIR_NAME),
  paragone_config: join(process.cwd(), PARAGONE_DIR_NAME, PARAGONE_CONFIG_NAME),
  paragone_db: join(process.cwd(), PARAGONE_DIR_NAME, PARAGONE_DB_NAME),
  paragone_shm: join(process.cwd(), PARAGONE_DIR_NAME, PARAGONE_DB_SHM_NAME),
  paragone_wal: join(
    process.cwd(),
    PARAGONE_DIR_NAME,
    PARAGONE_DB_WAL_PATH_NAME,
  ),
  paragone_log: join(process.cwd(), PARAGONE_DIR_NAME, PARAGONE_LOG_TXT_NAME),
  paragone_jsonl: join(
    process.cwd(),
    PARAGONE_DIR_NAME,
    PARAGONE_LOG_JSONL_NAME,
  ),
  analyze: "",
  classes: IMPACT_CLASSES as unknown as string[],
  scan: false,
  judge: false,
  reset: false,
  noninteractive: false,
  batch: 1,
  serve: false,
  port: 7331,
  host: "127.0.0.1",
  cors: [],
  public: "",
};

export type ProjectConfigDisk = Pick<
  ProjectConfig,
  "project" | "project_name" | "batch" | "port" | "host" | "cors" | "public"
>;

export const ProjectConfigDiskSchema = z.object({
  project: z.string(),
  project_name: z.string(),
  batch: z.number().gt(0).lt(10),
  port: z.number().gt(1000).lt(65535),
  host: z.ipv4(),
  cors: z.array(z.string()),
  public: z.string(),
});
