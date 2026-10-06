import { existsSync, statSync } from "node:fs";
import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { resolve } from "node:path";
import { Command } from 'commander';

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

export function isClassesCorrect(classes: string[]): boolean {
  let correctClasses = false
  if (classes) {
    (classes as string[]).forEach((cls) => {
      if (
        (IMPACT_CLASSES as readonly string[]).includes(cls.toUpperCase()) ===
          true ||
        cls.toUpperCase() === "ALL"
      ) {
        return correctClasses = true
      } else {
        correctClasses = false
      }
    });
  }
  return correctClasses
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

export function parseArguments(): void {
  const program = new Command()
  program
  .name('paragone')
  .description('Analyse statique d\'AST de fichier(s) JavaScript/TypeScript, découverte de schéma de code vulnérable et scoring de contrôlabilité des variables.')
  .requiredOption('-a, --analyze <chemin>', 'Dossier OU fichier à scanner. Requis.')
  .option('-p, --project <chemin>', 'Emplacement d\'un projet \'.paragone\' préexistant.')
  .option('--project-name <nom>', 'Nom du projet paragone. Enregistré à la création du projet.')
  .option('--project-name <nom>', 'Nom du projet paragone. Enregistré à la création du projet.')


}
