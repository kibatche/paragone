/**
 * @desc Constantes pour le parsing d'argument.
 */

import type { ParseArgsOptionsConfig } from "node:util";

export const DEFAULT_PROJECT_DIR = process.cwd();

export const PARAGONE_DIR_NAME = ".paragone";
export const PARAGONE_CONFIG_NAME = "paragone_config.json";
export const PARAGONE_DB_NAME = "findings.db";
export const PARAGONE_DB_SHM_NAME = "findings.db-shm";
export const PARAGONE_DB_WAL_PATH_NAME = "findings.db-wal";
export const PARAGONE_LOG_TXT_NAME = "log.txt";
export const PARAGONE_LOG_JSONL_NAME = "events.jsonl";

export const DEFAULT_BATCH = 1;

/** Port d'écoute par défaut de l'API ; l'hôte par défaut est local, Elysia écoutant sinon sur 0.0.0.0. */
export const DEFAULT_SERVE_PORT = 7331;
export const DEFAULT_SERVE_HOST = "127.0.0.1";

export const OPTIONS: ParseArgsOptionsConfig = {
  analyze: {
    type: "string",
    short: "a",
  },
  project: {
    type: "string",
    short: "p",
  },
  project_name: {
    type: "string",
  },
  scan: {
    type: "boolean",
    short: "s",
    default: false,
  },
  judge: {
    type: "boolean",
    short: "j",
    default: false,
  },
  batch: {
    type: "string",
    short: "b",
    default: "1",
  },
  classes: {
    type: "string",
    short: "c",
    default: ["all"],
    multiple: true,
  },
  reset: {
    type: "boolean",
    short: "r",
    default: false,
  },
  noninteractive: {
    type: "boolean",
    default: false,
  },
  serve: {
    type: "boolean",
    default: false,
  },
  port: {
    type: "string",
  },
  host: {
    type: "string",
  },
  cors: {
    type: "string",
    multiple: true,
  },
  public: {
    type: "string",
  },
  help: {
    type: "boolean",
    short: "h",
    default: false,
  },
};

export const HELP = `
paragone : triage statique de bundles JS et analyse du potentiel de vulnérabilité grâce à un juge de type 'System One'.

Utilisation : paragone [--analyze CHEMIN] [options]

OPTIONS

CONFIGURATION :
  -a, --analyze CHEMIN                              Dossier OU fichier à scanner.
  -p, --project CHEMIN                              Ouvre ou crée la configuration au chemin spécifié.
                                                    Si l'option est non spécifiée, tente d'ouvrir une éventuelle
                                                    configuration dans le chemin d'accès courant ou propose de la créer.
  --project_name NOM                                Spécifie le nom du projet. Défaut à 'basename($CWD)+_paragone_project'
  -b, --batch, défaut à '1'                         Nombre de "dossier(s)" à envoyer au juge.

ANALYSE :
  -c, --classes, défaut à 'all'.                    Analyse une ou plusieurs classe(s) de vulnérabilité. Insensible à la casse.
                                                    Répétable ou séparée par des virgules.
                                                    Classes possibles : cspt, xss, code_exec, open_redirect, web_message, all
  -s, --scan, défaut à 'false'.                     Lance le scan du dossier. Ne supprime aucune donnée pré-existante.
  -j, --judge, défaut à 'false'                     Lance le juge pour ce run. Ne supprime aucune donnée pré-existante.

CONTRÔLE :
  -r, --reset, défaut à 'false'                     ATTENTION ! Destructif. DETRUIT la base de donnée, et FORCE un scan du corpus.
                                                    Utilisé avec '--noninteractive', ne demande AUCUNE confirmation.
  --noninteractive, défaut à false                  Mode non-interactif. Permet d'utiliser les options '--reset' ou '--project'
                                                    sans TTY et SANS confirmation.

API :
  --serve, défaut à 'false'                         Lance l'API OpenAPI. Utilisable seul.
  --port PORT, défaut à '7331'                      Port d'écoute de l'API.
  --host ADRESSE, défaut à '127.0.0.1'              Adresse d'écoute de l'API.
  --cors ORIGINE(S)                                 Origine(s) autorisée(s) à appeler l'API depuis un autre site. Répétable ou séparée par des virgules.
  --public DOSSIER                                  Dossier du 'frontend' servi à la racine de l'API.

AIDE :
  -h, --help                                        Affiche cette aide et quitte le programme.

EXEMPLES:

$> paragone --analyze ./example.com --project ~/projects/megacorp --scan --judge --classes all
-> Crée ou ouvre un projet dans '~/projects/megacorp' puis, pour l'ensemble des classes de vulnérabilité, analyse le dossier 'example.com', et lance le juge.
    
$> paragone -a ./example.com -s -j -c cspt -c xss,web_message --reset --noninteractive
-> Pour les classes 'cspt','xss' et 'web_message', efface la base de données et REFAIT une analyse du dossier 'example.com', et REPASSE le juge sur les données d'analyse. Crée une nouvelle configuration.

$> paragone --serve
-> Lance l'API sur les données déjà en base, si existantes.

$> paragone -a ./example.com -s --serve --public ./dist --cors http://localhost:5173
-> Scanne, puis lance l'API qui sert aussi le front de ./dist, appelable depuis http://localhost:5173. Propose de créer une configuration 
`;
