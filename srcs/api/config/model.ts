/**
 * @author [A likely boring stuff made by] Shevek
 * @desc config/model.ts — Schémas de la configuration : le dossier, les classes et le lot que l'API lit et remplace.
 */

import { t } from "elysia";

const settings = {
  analyze: t.String({
    description: "Dossier ou fichier à scanner, en chemin absolu.",
  }),
  classes: t.Array(t.String(), {
    minItems: 1,
    description:
      "Classes d'impact que le juge examine, sans tenir compte de la casse ; `all` les désigne toutes.",
  }),
  batch: t.Integer({
    minimum: 1,
    description: "Nombre de leads envoyés en parallèle au juge.",
  }),
};

export const ConfigModel = {
  view: t.Object(settings),
  body: t.Object(settings),
} as const;
