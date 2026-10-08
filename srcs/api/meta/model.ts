/**
 * @author [A likely boring stuff made by] Shevek
 * @desc meta/model.ts : Schéma de la réponse de `/api/meta`.
 */

import { t } from "elysia";

export const MetaModel = {
  meta: t.Object({
    root: t.String({ description: "Dossier du projet." }),
    dbPath: t.String({ description: "Fichier de la base findings.db." }),
    apiVersion: t.String({ description: "Version du contrat de l'API." }),
  }),
} as const;
