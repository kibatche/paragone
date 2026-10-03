/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc config.ts : configuration et vérification des arguments de la run. `config` est l'unique objet de
 *       configuration : les arguments l'écrivent au lancement, `setConfig` l'écrit ensuite, et le reste du
 *       code le lit.
 */

import { parseArgs } from "util";
import {
  DEFAULT_SERVE_HOST,
  DEFAULT_SERVE_PORT,
  HELP,
  OPTIONS,
} from "./constants";
import type { ProjectConfig } from "./types";
import "node:fs";
import { existsSync, lstatSync, statSync } from "node:fs";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { basename, resolve } from "node:path";

export let config: ProjectConfig = {
  project_name: "dummy",
  classes: ["all"],
  analyze: "",
  scan: false,
  judge: false,
  batch: 1,
  reset: false,
  noninteractive: false,
  serve: false,
  port: DEFAULT_SERVE_PORT,
  host: DEFAULT_SERVE_HOST,
  cors: [],
};

function printHelpAndExit() {
  console.log(HELP.trim());
  process.exit(0);
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

/** @brief Refuse une option du service sans --serve, un port invalide et un dossier public introuvable. */
function checkServeArgs(values: {
  [longOption: string]: string | boolean | (string | boolean)[] | undefined;
}): void {
  const serveOnly = ["port", "host", "cors", "public"].filter(
    (name) => values[name] !== undefined,
  );
  if (values["serve"] !== true) {
    if (serveOnly.length === 0) return;
    throw new Error(
      `[ARGUMENT ERROR] ${serveOnly.map((name) => `--${name}`).join(", ")} n'a d'effet qu'avec --serve.`,
    );
  }
  if (values["port"] !== undefined) {
    const port = Number(values["port"]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(
        `[ARGUMENT ERROR] --port ${values["port"]} n'est pas un numéro de port (1 à 65535).`,
      );
  }
  const publicDir = values["public"];
  if (publicDir === undefined) return;
  if (
    typeof publicDir !== "string" ||
    !existsSync(publicDir) ||
    !statSync(publicDir).isDirectory()
  )
    throw new Error(
      `[ARGUMENT ERROR] Le dossier public '${publicDir}' n'existe pas.`,
    );
}

export function checkAnalyze(analyze: unknown): void {
  if (!analyze) {
    throw new Error(
      "[ARGUMENT ERROR] Vous devez spécifier le dossier OU le fichier à analyser à l'aide '--analyze'.",
    );
  }
  if (existsSync(analyze as string) === false) {
    throw new Error(
      `[ARGUMENT ERROR] Le fichier ou le dossier '${analyze}' n'existe pas.`,
    );
  }
  if (
    lstatSync(analyze as string).isDirectory() === false &&
    lstatSync(analyze as string).isFile() === false
  ) {
    throw new Error(
      `[ARGUMENT ERROR] L'objet '${analyze}' n'est ni un fichier, ni un dossier.`,
    );
  }
}

function checkBatch(batch: unknown): void {
  if (batch !== undefined && isNaN(Number(batch))) {
    throw new Error(`[ARGUMENT ERROR] 'batch' n'est pas un nombre.`);
  }
}

function checkClasses(classes: unknown): void {
  if (classes) {
    (classes as string[]).forEach((cls) => {
      if (
        (IMPACT_CLASSES as readonly string[]).includes(cls.toUpperCase()) ===
          false &&
        cls.toUpperCase() !== "ALL"
      ) {
        throw new Error(
          `[ARGUMENT ERROR] ${cls} n'est pas une classe de vulnérabilité prise charge. Autorisées : ${(IMPACT_CLASSES as readonly string[]).join(" ").trim()}.`,
        );
      }
    });
  }
}

function checkArgs(values: {
  [longOption: string]: string | boolean | (string | boolean)[] | undefined;
}): void {
  if (values["help"] === true) printHelpAndExit();
  checkServeArgs(values);
  if (
    values["scan"] === false &&
    values["judge"] === false &&
    values["reset"] === false &&
    values["serve"] === false
  ) {
    console.log("Rien à faire, bye.");
    process.exit(0);
  }
  if (
    values["scan"] === true ||
    values["judge"] === true ||
    values["reset"] === true
  ) {
    checkAnalyze(values["analyze"]);
  }
  checkBatch(values["batch"]);
  checkClasses(values["classes"]);
}

export function getConfig() {
  try {
    const { values } = parseArgs({
      args: Bun.argv,
      options: OPTIONS,
      allowPositionals: true,
    });

    checkArgs(values);

    config = {
      project_name: basename(values["project_name"] as string),
      classes: normalizeClasses(values["classes"] as string[]),
      analyze:
        values["analyze"] === undefined
          ? config.analyze
          : resolve(values["analyze"] as string),
      scan: values["scan"] as boolean,
      judge: values["judge"] as boolean,
      batch: Number(values["batch"]),
      reset: values["reset"] as boolean,
      noninteractive: values["noninteractive"] as boolean,
      serve: values["serve"] as boolean,
      port: values["port"] ? Number(values["port"]) : DEFAULT_SERVE_PORT,
      host: (values["host"] as string | undefined) ?? DEFAULT_SERVE_HOST,
      cors: splitList((values["cors"] as string[] | undefined) ?? []),
      public: values["public"]
        ? resolve(values["public"] as string)
        : undefined,
    };
  } catch (e) {
    console.error("[ERROR]", e);
    process.exit(1);
  }
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
