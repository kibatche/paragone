import { IMPACT_CLASSES } from "../analyze/constants/lead";
import { Command, Option, type OptionValues } from "commander";
import type { ZodType } from "zod";
import { PartialProjectSchema } from "./types";
import { SERVER_OPTIONS } from "./constants";

export function isClassesCorrect(classes: string[]): boolean {
  let correctClasses = false;
  if (classes) {
    (classes as string[]).forEach((cls) => {
      if (
        (IMPACT_CLASSES as readonly string[]).includes(cls.toUpperCase()) ===
          true ||
        cls.toUpperCase() === "ALL"
      ) {
        return (correctClasses = true);
      } else {
        correctClasses = false;
      }
    });
  }
  return correctClasses;
}

/** @description Valeur par défaut d'un membre d'un schéma */
function defaultOf(field: ZodType): string {
  return String(field.parse(undefined));
}

/** @description Accumule une option répétable dont chaque valeur peut être une liste séparée par des virgules */
function collectList(value: string, previous: string[] = []): string[] {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return [...previous, ...items];
}

function withGroup(heading: string, options: Option[]): Option[] {
  return options.map((option) => option.helpGroup(heading));
}

function projectOptions(): Option[] {
  return [
    new Option(
      "-p, --project-path <dir>",
      "Dossier du projet (défaut : dossier courant)",
    ),
    new Option(
      "-n, --project-name <name>",
      "Nom du projet (défaut : nom du dossier)",
    ),
  ];
}

function analysisOptions(): Option[] {
  return [
    new Option(
      "-a, --analyze <path>",
      "Dossier ou fichier à scanner",
    ).makeOptionMandatory(),
    new Option(
      "-c, --classes <classes...>",
      `Classes de vulnérabilité à analyser, parmi : ${IMPACT_CLASSES.join(", ")}, ALL. Insensible à la casse, répétable ou séparée par des virgules (défaut : toutes)`,
    ).argParser(collectList),
    new Option("--no-scan", "Saute le scan du dossier"),
  ];
}

function judgeOptions(): Option[] {
  return [
    new Option(
      "-j, --judge",
      "Lance le juge pour ce run. Ne supprime aucune donnée pré-existante",
    ),
    new Option(
      "-b, --batch <n>",
      `Nombre de dossier(s) à envoyer au juge, strictement entre 0 et 10 (défaut : ${defaultOf(PartialProjectSchema.shape.batch)})`,
    ),
  ];
}

function serverOptions(): Option[] {
  return [
    new Option("-s, --serve", "Lance l'API. Utilisable seul"),
    new Option(
      "-H, --host <ip>",
      `Adresse d'écoute de l'API (défaut : ${defaultOf(PartialProjectSchema.shape.host)})`,
    ),
    new Option(
      "-P, --port <n>",
      `Port d'écoute de l'API (défaut : ${defaultOf(PartialProjectSchema.shape.port)})`,
    ),
    new Option(
      "--cors <origins...>",
      "Origine(s) autorisée(s) à appeler l'API depuis un autre site. Répétable ou séparée par des virgules",
    ).argParser(collectList),
    new Option(
      "--public <dir>",
      "Dossier du frontend servi à la racine de l'API",
    ),
  ];
}

function generalOptions(): Option[] {
  return [
    new Option(
      "-r, --reset",
      "ATTENTION, destructif : détruit la base de données et force un scan du corpus",
    ),
    new Option(
      "--noninteractive",
      "Mode non-interactif : --reset et --project-path s'utilisent sans TTY et sans confirmation",
    ),
  ];
}

export function buildProgram(): Command {
  const program = new Command("paragone");
  const groups = [
    withGroup("Projet :", projectOptions()),
    withGroup("Analyse :", analysisOptions()),
    withGroup("Jugement :", judgeOptions()),
    withGroup(
      "Serveur (host, port, cors et public n'ont d'effet qu'avec --serve) :",
      serverOptions(),
    ),
    withGroup("Général :", generalOptions()),
  ];

  for (const option of groups.flat()) {
    program.addOption(option);
  }
  return program;
}

function assertServerOptionsNeedServe(program: Command): void {
  if (program.opts().serve) return;

  const given = SERVER_OPTIONS.filter(
    (name) => program.getOptionValueSource(name) === "cli",
  );
  if (given.length === 0) return;

  const flags = given.map((name) => `--${name}`).join(", ");
  program.error(`${flags} : option sans effet sans --serve.`);
}

/**
 * @description Renomme `projectPath` et `projectName` (clés Commander) en `paragone_project_path` et
 * `paragone_project_name` (clés des schémas Zod). Une option non fournie n'a pas de clé, pour ne pas
 * écraser la valeur du disque lors de la fusion.
 */
function renameProjectKeys(options: OptionValues): Record<string, unknown> {
  const { projectPath, projectName, ...shared } = options;
  const renamed: Record<string, unknown> = { ...shared };
  if (projectPath !== undefined) renamed.paragone_project_path = projectPath;
  if (projectName !== undefined) renamed.paragone_project_name = projectName;
  return renamed;
}

/** @description Args et surcharges de config de la ligne de commande, bruts : Zod les valide au chargement. */
export function parseCliOptions(argv: string[]): Record<string, unknown> {
  const program = buildProgram();
  program.parse(argv);
  assertServerOptionsNeedServe(program);
  return renameProjectKeys(program.opts());
}
