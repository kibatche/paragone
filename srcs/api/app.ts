/**
 * @author [A likely boring stuff made by] Shevek
 * @desc app.ts : Assemble l'API : les routes de données, le contrat OpenAPI (`/openapi`, `/openapi/json`),
 *       l'ouverture aux autres origines, puis le dossier public servi à `/`, avec repli sur son
 *       index.html pour les pages d'un front. L'application est rendue sans écouter : `start.ts` lui
 *       donne un port, les tests l'appellent directement.
 */

import { cors } from "@elysia/cors";
import { openapi } from "@elysia/openapi";
import { staticPlugin } from "@elysia/static";
import { Elysia } from "elysia";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createJevClient } from "../judge/jev/client";
import { catalog } from "./catalog";
import { configuration } from "./config";
import { API_PREFIX, API_VERSION, DEFAULT_PUBLIC_DIR } from "./constants";
import { corpus } from "./corpus";
import { jobs } from "./jobs";
import { leads } from "./leads";
import { meta } from "./meta";
import { review } from "./review";
import { source } from "./source";
import { stats } from "./stats";
import type { ApiOptions } from "./types";

const TAGS = [
  { name: "meta", description: "Le projet servi." },
  { name: "stats", description: "Compteurs de la base et usage du juge." },
  { name: "leads", description: "La file de triage et le détail d'un lead." },
  { name: "review", description: "Revue humaine d'un lead." },
  { name: "source", description: "Code source d'un lead." },
  { name: "corpus", description: "Fichiers scannés et matches des analyzers." },
  { name: "catalog", description: "Valeurs énumérées, analyzers, références." },
  {
    name: "config",
    description: "Dossier à analyser, classes jugées et taille des lots.",
  },
  { name: "jobs", description: "Scan et juge lancés par l'API." },
];

function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/** Une page de front : GET sur un chemin sans extension, hors de l'API et de sa documentation. */
function isPagePath(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  if (pathname.startsWith("/openapi")) return false;
  return !/\.[^/]+$/.test(pathname);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function assertDirectory(path: string): void {
  if (!isDirectory(path))
    throw new Error(`Error [createApp]: dossier public introuvable : ${path}`);
}

/** @throws si le dossier public n'existe pas, avec son chemin. */
export async function createApp(options: ApiOptions): Promise<Elysia> {
  const publicDir = resolve(options.publicDir ?? DEFAULT_PUBLIC_DIR);
  assertDirectory(publicDir);

  const indexPath = join(publicDir, "index.html");
  const app = new Elysia();
  app.onError(({ code, request, status }) => {
    if (code !== "NOT_FOUND") return;
    const { pathname } = new URL(request.url);
    if (isApiPath(pathname)) return status(404, { error: "route inconnue" });
    if (isPagePath(request.method, pathname) && existsSync(indexPath))
      return status(200, Bun.file(indexPath));
  });
  app.use(
    openapi({
      documentation: {
        info: {
          title: "paragone",
          version: API_VERSION,
          description:
            "Données de findings.db : leads et jugements, corpus scanné, usage du juge.",
        },
        tags: TAGS,
      },
    }),
  );
  if (options.cors.length > 0) app.use(cors({ origin: options.cors }));
  app
    .use(meta)
    .use(stats)
    .use(leads)
    .use(review)
    .use(source)
    .use(corpus)
    .use(catalog)
    .use(configuration)
    .use(jobs({ createClient: options.createJudgeClient ?? createJevClient }));
  app.use(
    await staticPlugin({ assets: publicDir, prefix: "/", indexHTML: true }),
  );
  return app;
}
