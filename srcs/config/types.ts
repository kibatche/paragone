import { basename, join } from "node:path";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import * as z from "zod";
import {
  DEFAULT_PUBLIC_DIR,
  PARAGONE_CONFIG_NAME,
  PARAGONE_DB_NAME,
  PARAGONE_DB_SHM_NAME,
  PARAGONE_DB_WAL_PATH_NAME,
  PARAGONE_DIR_NAME,
  PARAGONE_LOG_JSONL_NAME,
  PARAGONE_LOG_TXT_NAME,
} from "./constants";
import { isDirectory, isFile } from "../path_utils/path_utils";
import { isClassesCorrect } from "./check_arguments";


/**Lié à la CLI */
export interface CliOptions {
  projectPath?: string;
  projectName?: string;
  analyze: string;
  classes?: string[];
  scan: boolean;
  judge?: boolean;
  batch?: string;
  reset?: boolean;
  noninteractive?: boolean;
  serve?: boolean;
  host?: string;
  port?: string;
  cors?: string[];
  public?: string;
}

/** Liés à Zod */

/** @brief Permet de customiser les erreurs de zod. */
function customErrors(iss: z.core.$ZodRawIssue): string | undefined {
  const field = iss.path?.join(".") ?? "[champ inconnu]";
  switch (iss.code) {
    case "invalid_type":
      return `<${field}> : ${iss.expected} attendu.`;
    case "too_big":
      return `<${field}> : ${iss.maximum} au maximum${iss.inclusive ? "" : " (exclu)"}.`;
    case "too_small":
      return `<${field}> : ${iss.minimum} au minimum${iss.inclusive ? "" : " (exclu)"}.`;
    case "invalid_format":
      return `<${field}> : format ${iss.format} attendu.`;
    case "not_multiple_of":
      return `<${field}> : multiple de ${iss.divisor} attendu.`;
    case "invalid_value":
      return `<${field}> : parmi ${iss.values.join(", ")}.`;
    case "unrecognized_keys":
      return `<${field}> : clé(s) inconnue(s) ${iss.keys.join(", ")}.`;
    case "invalid_element":
      return `<${field}> : valeur refusée pour la clé ${JSON.stringify(iss.key)} (${iss.issues.map((i) => i.message).join(" ; ")}).`;
    case "invalid_key":
      return `<${field}> : clé refusée (${iss.issues.map((i) => i.message).join(" ; ")})..`;
    case "invalid_union": {
      const attendus = iss.errors.flat().filter((e) => e.code === "invalid_type").map((e) => e.expected);
      return attendus.length ? `<${field}> : ${[...new Set(attendus)].join(" ou ")} attendu.` : `<${field}> : aucune variante ne convient.`;
    }
    default:
      return undefined;
  }
}

z.config({customError: customErrors})

export const PersistentConfigSchema = z.object({
  batch: z.coerce.number().gt(0).lt(10).default(1),
  port: z.coerce.number().gt(1000).lt(65535).default(7331),
  host: z.ipv4().or(z.ipv6()).default("127.0.0.1"),
  cors: z.array(z.ipv4().or(z.ipv6())).default([]),
  public: z.string().default(DEFAULT_PUBLIC_DIR).refine((p) => isDirectory(p), {error: (iss) => `<public> : '${iss.input}' n'est pas un dossier.`}),
})

const ProjectInputSchema = z.object({
  paragone_project_path: z.string().default(() => process.cwd()).refine((p) => isDirectory(p), {error: (iss) => `<projet> : '${iss.input}' n'est pas un dossier.`}),
  classes: z.array(z.string()).default(IMPACT_CLASSES as unknown as string[]).refine(p => isClassesCorrect(p), { error: (iss) => `<classes> : [${(iss.input as string[]).join(' ')}] contient une ou plusieurs valeurs incorrectes.`}),
  analyze: z.string().refine(p => isDirectory(p) || isFile(p), { error: (iss) => `<analyze> : '${iss.input}' n'est ni un fichier, ni un dossier`}),
  scan: z.boolean().default(true),
  judge: z.boolean().default(false),
  serve: z.boolean().default(false),
  reset: z.boolean().default(false),
  noninteractive: z.boolean().default(false),
})

export const PartialProjectSchema = PersistentConfigSchema.extend(ProjectInputSchema.shape)

export type PersistentConfig = z.infer<typeof PersistentConfigSchema>

/** Ce que le fichier de configuration conserve d'un run à l'autre : la config, jamais les args. */
export const DiskConfigSchema = PersistentConfigSchema.extend({
  paragone_project_name: z.string().optional(),
});
export type DiskConfig = z.infer<typeof DiskConfigSchema>;


export function getProjectConfigSchema(projectInputSchema: typeof PartialProjectSchema, projectPath: string) {
  return projectInputSchema.extend({
    paragone_project_name: z.string().default(basename(projectPath)),
    paragone_directory: z.string().default(join(projectPath, PARAGONE_DIR_NAME)),
    paragone_config_file: z.string().default(join(projectPath, PARAGONE_DIR_NAME, PARAGONE_CONFIG_NAME)),
    paragone_db_file: z.string().default(join(projectPath, PARAGONE_DIR_NAME, PARAGONE_DB_NAME)),
    paragone_shm_file: z.string().default(join(projectPath, PARAGONE_DIR_NAME, PARAGONE_DB_SHM_NAME)),
    paragone_wal_file: z.string().default(join(
      projectPath,
      PARAGONE_DIR_NAME,
      PARAGONE_DB_WAL_PATH_NAME,
    )),
    paragone_log: z.string().default(join(projectPath, PARAGONE_DIR_NAME, PARAGONE_LOG_TXT_NAME)),
    paragone_jsonl: z.string().default(join(
      projectPath,
      PARAGONE_DIR_NAME,
      PARAGONE_LOG_JSONL_NAME,
    )),
  })
}

export type FullProjectConfigSchema = ReturnType<typeof getProjectConfigSchema>
