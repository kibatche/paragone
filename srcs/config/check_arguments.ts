import { existsSync, lstatSync, statSync } from "node:fs";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { resolve } from "node:path";

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
      `[ERREUR ARGUMENT] ${serveOnly.map((name) => `--${name}`).join(", ")} n'a d'effet qu'avec --serve.`,
    );
  }
  if (values["port"] !== undefined) {
    const port = Number(values["port"]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(
        `[ERREUR ARGUMENT] --port ${values["port"]} n'est pas un numéro de port (1 à 65535).`,
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
      `[ERREUR ARGUMENT] Le dossier public '${publicDir}' n'existe pas.`,
    );
}

export function checkAnalyze(analyze: unknown): void {
  if (!analyze) {
    throw new Error(
      "[ERREUR ARGUMENT] Vous devez spécifier le dossier OU le fichier à analyser à l'aide '--analyze'.",
    );
  }
  if (existsSync(analyze as string) === false) {
    throw new Error(
      `[ERREUR ARGUMENT] Le fichier ou le dossier '${analyze}' n'existe pas.`,
    );
  }
  if (
    lstatSync(analyze as string).isDirectory() === false &&
    lstatSync(analyze as string).isFile() === false
  ) {
    throw new Error(
      `[ERREUR ARGUMENT] L'objet '${analyze}' n'est ni un fichier, ni un dossier.`,
    );
  }
}

export function checkBatch(batch: unknown): void {
  if (batch !== undefined && isNaN(Number(batch))) {
    throw new Error(`[ERREUR ARGUMENT] 'batch' n'est pas un nombre.`);
  }
}

export function checkClasses(classes: unknown): void {
  if (classes) {
    (classes as string[]).forEach((cls) => {
      if (
        (IMPACT_CLASSES as readonly string[]).includes(cls.toUpperCase()) ===
          false &&
        cls.toUpperCase() !== "ALL"
      ) {
        throw new Error(
          `[ERREUR ARGUMENT] ${cls} n'est pas une classe de vulnérabilité prise charge. Autorisées : ${(IMPACT_CLASSES as readonly string[]).join(" ").trim()}.`,
        );
      }
    });
  }
}

export function checkProject(project: unknown): void {
  if (project) {
    const projectFullPath = resolve(project as string);
    if (
      existsSync(projectFullPath) === false &&
      statSync(projectFullPath).isDirectory() === false
    ) {
      throw new Error(
        `[ERREUR ARGUMENT] ${project} n'existe pas ou n'est pas un dossier.`,
      );
    }
  }
}

export function checkArgs(values: {
  [longOption: string]: string | boolean | (string | boolean)[] | undefined;
}): void {
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
  checkProject(values["project"]);
  checkClasses(values["classes"]);
}
