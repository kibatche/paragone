/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc config.ts : configuration et vérification des arguments de la run. `config` est l'unique objet de
 *       configuration : les arguments l'écrivent au lancement, `setConfig` l'écrit ensuite, et le reste du
 *       code le lit.
 */

import {
  DEFAULT_PROJECT_DIR,
  PARAGONE_CONFIG_NAME,
  PARAGONE_DB_NAME,
  PARAGONE_DB_SHM_NAME,
  PARAGONE_DB_WAL_PATH_NAME,
  PARAGONE_DIR_NAME,
  PARAGONE_LOG_JSONL_NAME,
  PARAGONE_LOG_TXT_NAME,
} from "./constants";
import {
  defaultConfig,
  ProjectConfigDiskSchema,
  type ProjectConfig,
  type ProjectConfigDisk,
} from "./types";
import "node:fs";
import { existsSync, statSync } from "node:fs";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { basename, join, resolve } from "node:path";
import * as z from "zod";
import { checkAnalyze, checkBatch, checkClasses } from "./check_arguments";

export let config: ProjectConfig = { ...defaultConfig };

export function isConfigExists(path?: string): boolean {
  if (path !== undefined) return existsSync(path);
  return existsSync(DEFAULT_PROJECT_DIR);
}

function splitList(rawValues: string[]): string[] {
  return rawValues
    .flatMap((raw) => raw.split(","))
    .map((value) => value.trim())
    .filter((value) => value !== "");
}

function normalizeClasses(rawClasses: string[]): string[] {
  const classes = new Set(
    rawClasses
      .flatMap((rawcls) => rawcls.split(","))
      .map((name) => name.trim().toUpperCase())
      .filter((name) => name !== ""),
  );

  return classes.has("ALL") ? [...IMPACT_CLASSES] : [...classes];
}

async function readConfigFileFromDisk(configPath: string): Promise<unknown> {
  const file = Bun.file(configPath);
  try {
    const jsonConfig: unknown = await file.json();
    return jsonConfig;
  } catch (e) {
    console.error("[CONFIG FILE ERROR]", e);
    process.exit(1);
  }
}

export async function readExistingConfigOnDisk(
  projecPath: string,
): Promise<ProjectConfigDisk | undefined> {
  if (projecPath) {
    const paragoneProjectPath = join(projecPath, PARAGONE_DIR_NAME);
    if (
      existsSync(paragoneProjectPath) &&
      statSync(paragoneProjectPath).isDirectory()
    ) {
      const paragoneConfigPath = join(
        paragoneProjectPath,
        PARAGONE_CONFIG_NAME,
      );
      if (
        existsSync(paragoneConfigPath) &&
        statSync(paragoneConfigPath).isFile()
      ) {
        const configFromDisk: unknown =
          await readConfigFileFromDisk(paragoneConfigPath);
        try {
          const configToParse =
            await ProjectConfigDiskSchema.parseAsync(configFromDisk);
          console.log("[LOG] Configuration récupérée du disque !");
          return configToParse;
        } catch (e) {
          if (e instanceof z.ZodError)
            console.error(
              "[CONFIG INVALIDE] Zod n'a pas validé la configuration venant du disque. Elle sera recréée.",
            );
          else
            console.error(
              "[CONFIG INVALIDE] Une erreur est survenue lors du chargemetn de la configuration. Elle sera recréée.",
            );
          return undefined;
        }
      }
      console.log(
        "[LOG] Aucune configuration détectée, une nouvelle sera créée.",
      );
    }
  }
}

export async function writeConfigFileOnDisk(): Promise<void> {
  const configFile = Bun.file(config.paragone_config);
  await configFile.write(
    JSON.stringify(config as ProjectConfigDisk, undefined, 2),
  );
}

export function createConfigInMemory(
  values: {
    [longOption: string]: string | boolean | (string | boolean)[] | undefined;
  },
  configFromDisk?: ProjectConfigDisk,
): void {
  const project: string = values["project"]
    ? resolve(values["project"] as string)
    : (configFromDisk?.project ?? config.project);
  const project_name: string = values["project_name"]
    ? resolve(basename(values["project"] as string))
    : (configFromDisk?.project_name ?? config.project_name);

  config = {
    project: project,
    project_name: project_name,
    paragone_dir: join(project, PARAGONE_DIR_NAME),
    paragone_config: join(project, PARAGONE_DIR_NAME, PARAGONE_CONFIG_NAME),
    paragone_db: join(project, PARAGONE_DIR_NAME, PARAGONE_DB_NAME),
    paragone_shm: join(project, PARAGONE_DIR_NAME, PARAGONE_DB_SHM_NAME),
    paragone_wal: join(project, PARAGONE_DIR_NAME, PARAGONE_DB_WAL_PATH_NAME),
    paragone_log: join(project, PARAGONE_DIR_NAME, PARAGONE_LOG_TXT_NAME),
    paragone_jsonl: join(project, PARAGONE_DIR_NAME, PARAGONE_LOG_JSONL_NAME),
    classes: values["classes"]
      ? normalizeClasses(values["classes"] as string[])
      : config.classes,
    analyze: resolve(values["analyze"] as string),
    scan: values["scan"] as boolean,
    judge: values["judge"] as boolean,
    batch: values["batch"]
      ? Number(values["batch"])
      : (configFromDisk?.batch ?? config.batch),
    reset: values["reset"] as boolean,
    noninteractive: values["noninteractive"] as boolean,
    serve: values["serve"] as boolean,
    host: values["host"]
      ? (values["host"] as string)
      : (configFromDisk?.host ?? config.host),
    port: values["port"]
      ? Number(values["port"])
      : (configFromDisk?.port ?? config.port),
    cors: values["cors"]
      ? splitList(values["cors"] as string[])
      : (configFromDisk?.cors ?? []),
    public: values["public"]
      ? resolve(values["public"] as string)
      : (configFromDisk?.public ?? ""),
  };
}

/**
 * @brief Remplace le dossier, les classes et le lot de `config`, avec les mêmes vérifications que les arguments.
 * @throws si une valeur est refusée ; `config` reste alors intact.
 */
export function setConfig(values: {
  analyze: string;
  classes: string[];
  batch: number;
}): void {
  checkAnalyze(values.analyze);
  checkClasses(values.classes);
  checkBatch(values.batch);

  Object.assign(config, {
    analyze: resolve(values.analyze),
    classes: normalizeClasses(values.classes),
    batch: Number(values.batch),
  });
}
export { checkAnalyze };
