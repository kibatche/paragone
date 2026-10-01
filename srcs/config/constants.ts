/**
 * @desc Constantes pour le parsing d'argument.
 */

/**
 * @desc Constantes pour la configuration.
 */

import { join } from "node:path";
import type { ParseArgsOptionsConfig } from "node:util";

export const ROOT = process.cwd();
export const PARAGONE_DIR = join(ROOT, ".paragone");
export const CONFIG_PATH = join(PARAGONE_DIR, "config.json");
export const DB_PATH = join(PARAGONE_DIR, "findings.db");
export const DB_SHM_PATH = join(PARAGONE_DIR, "findings.db-shm");
export const DB_WAL_PATH = join(PARAGONE_DIR, "findings.db-wal");
export const LOG_TXT = join(PARAGONE_DIR, "log.txt");
export const LOG_JSONL = join(PARAGONE_DIR, "events.jsonl");


/** Port d'écoute par défaut de l'API ; l'hôte par défaut est local, Elysia écoutant sinon sur 0.0.0.0. */
export const DEFAULT_SERVE_PORT = 7331;
export const DEFAULT_SERVE_HOST = "127.0.0.1";

export const OPTIONS: ParseArgsOptionsConfig = {
  analyze: {
    type: "string",
    short: "a",
  },
  scan: {
    type: "boolean",
    short: "s",
    default: false
  },
  judge: {
    type: "boolean",
    short: "j",
    default: false
  },
  batch: {
    type: "string",
    short: "b",
    default: "1"
  },
  classes: {
    type: "string",
    short: "c",
    default: ["all"],
    multiple: true
  },
  reset: {
    type: "boolean",
    short: "r",
    default: false,
  },
  noninteractive: {
    type: "boolean",
    default: false
  },
  project_name: {
    type: "string",
    short: "p",
    default: process.cwd()
  },
  serve: {
    type: "boolean",
    default: false
  },
  port: {
    type: "string"
  },
  host: {
    type: "string"
  },
  cors: {
    type: "string",
    multiple: true
  },
  public: {
    type: "string"
  },
  help: {
    type: "boolean",
    short: "h",
    default: false
  },
};

export const HELP = `
paragone : triage statique de vulns client-side sur bundles JS et analyse du potentiel de vulnérabilité grâce à un juge de type 'System One'.

Utilisation : paragone [--analyze PATH] [options]

OPTIONS
  -a, --analyze <chemin>, aucune valeur par défaut. Dossier OU fichier à scanner. Ne scanne pas les dossiers vendors.
  -s, --scan, défaut à 'false'.                     Lance le scan du dossier. Ne supprime aucune donnée pré-existante.
  -j, --judge, défaut à 'false'                     Lance le juge pour ce run. Ne supprime aucune donnée pré-existante.
  -b, --batch, défaut à '1'                         Nombre de "dossier(s)" à envoyer au juge.
  -c, --classes                                     Analyse une ou plusieurs classe(s) de vulnérabilité. Insensible à la casse.
    <cspt,xss,code_exec,                            Exemple : 'paragone (...) -c cspt -c XSS' ou "paragone (...) -c cspt,xss".
    open_redirect,web_message,all>
    , défaut à 'all'.
  -r, --reset, défaut à 'false'                     ATTENTION ! Destructif. DETRUIT la base de donnée, et FORCE une réanalyse du corpus. Pour juger, l'option '--judge' est nécessaire.
                                                    Si la commande est lancée sans TTY '--noninteractive' est obligatoire.
  --noninteractive, défaut à false                  Mode non-interactif, utile sans TTY de disponible, afin d'opérer un '--reset' sans demande de confirmation.
  -p, --project_name, défaut                        Le nom du projet.
    au nom du dossier courant
  --serve, défaut à 'false'                      Lance l'API (données de la base, contrat OpenAPI sur /openapi) une fois le scan et le juge demandés terminés.
                                                    Seul, il ne demande pas --analyze.
  --port <n>, défaut à '7331'                     Port d'écoute de l'API. Exige --serve.
  --host <adresse>, défaut à '127.0.0.1'          Adresse d'écoute de l'API. Une adresse non locale expose au réseau /api/lead/:id/open (lance l'éditeur), /api/lead/:id/human (écrit en base), /api/config (change le dossier, les classes et le lot), /api/scan et /api/judge (lancent un travail). Exige --serve.
  --cors <origine>                                  Origine autorisée à appeler l'API depuis un autre site, par exemple http://localhost:5173. Répétable ou séparée par des virgules ; aucune par défaut. Exige --serve.
  --public <dossier>                                Dossier servi à la racine de l'API (le front construit). Par défaut, la page factice livrée. Exige --serve.
  -h, --help                                        Affiche cette aide et quitte le programme.

CONFIGURATION
  Le dossier à analyser, les classes et le lot se règlent par ces arguments. Avec --serve, PUT /api/config les change ensuite en mémoire, le temps du service : rien n'est enregistré.

EXEMPLES:
    paragone -a ./example.com -s -j -c all          Pour l'ensemble des classe de vulnérabilité, analyse le dossier 'example.com', et passe le juge sur les données d'analyse.
    paragone -a ./example.com -s -j -c cspt --reset  Pour la classe 'cspt', REFAIT une analyse du dossier 'example.com', et REPASSE le juge sur les données d'analyse.
    paragone --serve                                 Lance l'API sur les données déjà en base.
    paragone -a ./example.com -s --serve --public ./dist --cors http://localhost:5173
                                                    Scanne, puis lance l'API qui sert aussi le front de ./dist, appelable depuis http://localhost:5173.
`;