/**
 * @author [A likely boring stuff made by] Shevek
 * @desc source/model.ts : Schémas de la lecture de source et de l'ouverture dans l'éditeur.
 */

import { t } from "elysia";

export const SourceModel = {
  query: t.Object({ id: t.Numeric({ description: "Identifiant du lead." }) }),
  source: t.Object({
    file: t.String(),
    targetLine: t.Number(),
    text: t.String({ description: "Contenu brut complet du fichier." }),
  }),
} as const;
