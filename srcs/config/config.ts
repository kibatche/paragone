/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc config.ts : charge la configuration du run (défauts Zod, config persistante du disque, args de la
 *       ligne de commande) dans `config`, que `setConfig` met à jour ensuite et que le reste du code lit.
 */

import { join, resolve } from "node:path";
import * as z from "zod";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { isFile } from "../path_utils/path_utils";
import { PARAGONE_CONFIG_NAME, PARAGONE_DIR_NAME } from "./constants";
import {
  DiskConfigSchema,
  PartialProjectSchema,
  getProjectConfigSchema,
  type DiskConfig,
  type FullProjectConfigSchema,
} from "./types";

export type ProjectConfig = z.output<FullProjectConfigSchema>;

export let config: ProjectConfig;

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("\n");
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

function resolveProjectPath(args: Record<string, unknown>): string {
  const given = args.paragone_project_path;
  return resolve(typeof given === "string" ? given : process.cwd());
}

/** @description Une config disque absente ou invalide n'est pas fatale : elle est signalée, puis recréée. */
async function readDiskConfig(
  projectPath: string,
): Promise<DiskConfig | undefined> {
  const configFile = join(projectPath, PARAGONE_DIR_NAME, PARAGONE_CONFIG_NAME);
  if (!isFile(configFile)) {
    console.log(
      "[LOG] Aucune configuration détectée, une nouvelle sera créée.",
    );
    return undefined;
  }

  let raw: unknown;
  try {
    raw = await Bun.file(configFile).json();
  } catch (error) {
    console.error(
      `[CONFIG INVALIDE] ${configFile} n'est pas un JSON lisible : ${error}. Elle sera recréée.`,
    );
    return undefined;
  }

  const parsed = DiskConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      `[CONFIG INVALIDE] ${configFile} :\n${describeIssues(parsed.error)}\nElle sera recréée.`,
    );
    return undefined;
  }
  console.log("[LOG] Configuration récupérée du disque !");
  return parsed.data;
}

/**
 * @description Les couches se superposent dans cet ordre : défauts Zod, config du disque, args de la ligne
 * de commande, chemins dérivés du projet. Un seul `parse` du schéma complet les valide ensemble.
 * @throws si une valeur est refusée : le run ne peut pas continuer.
 */
export async function loadConfig(args: Record<string, unknown>): Promise<void> {
  const projectPath = resolveProjectPath(args);
  const disk = await readDiskConfig(projectPath);
  const schema = getProjectConfigSchema(PartialProjectSchema, projectPath);

  const parsed = schema.safeParse({
    ...disk,
    ...args,
    paragone_project_path: projectPath,
  });
  if (!parsed.success) {
    throw new Error(`Configuration refusée :\n${describeIssues(parsed.error)}`);
  }

  config = {
    ...parsed.data,
    analyze: resolve(parsed.data.analyze),
    classes: normalizeClasses(parsed.data.classes),
    public: resolve(parsed.data.public),
  };
}

export async function writeConfigFileOnDisk(): Promise<void> {
  const persisted = DiskConfigSchema.parse(config);
  await Bun.write(
    config.paragone_config_file,
    JSON.stringify(persisted, undefined, 2),
  );
}

/** @throws si `analyze` n'est ni un fichier, ni un dossier. */
export function checkAnalyze(analyze: string): void {
  const result = PartialProjectSchema.shape.analyze.safeParse(analyze);
  if (!result.success) throw new Error(describeIssues(result.error));
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
  const result = PartialProjectSchema.pick({
    analyze: true,
    classes: true,
    batch: true,
  }).safeParse(values);
  if (!result.success) throw new Error(describeIssues(result.error));

  Object.assign(config, {
    analyze: resolve(result.data.analyze),
    classes: normalizeClasses(result.data.classes),
    batch: result.data.batch,
  });
}
