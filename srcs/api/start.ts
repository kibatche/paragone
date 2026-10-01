/**
 * @author [A likely boring stuff made by] Shevek
 * @desc start.ts — Lance l'API : ouvre la base, construit l'application et écoute sur l'adresse demandée.
 */

import { initDatabase } from "../db/db";
import { createApp } from "./app";
import { LOOPBACK_HOSTS } from "./constants";
import type { ApiOptions } from "./types";

/** @throws si le dossier public est introuvable ou si le port est pris. */
export async function startApi(options: ApiOptions) {
  initDatabase();
  const app = await createApp(options);
  app.listen({ hostname: options.host, port: options.port });
  console.log(
    `[api] http://${options.host}:${options.port}  (contrat : /openapi)`,
  );
  if (!LOOPBACK_HOSTS.includes(options.host)) {
    console.warn(
      `[api] ⚠️  ${options.host} est joignable depuis le réseau : /api/lead/:id/open lance l'éditeur, /api/lead/:id/human et /api/config écrivent dans la base, /api/scan et /api/judge lancent un travail (le juge dépense des tokens).`,
    );
  }
  return app;
}
