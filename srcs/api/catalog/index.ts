/**
 * @author [A likely boring stuff made by] Shevek
 * @desc catalog/index.ts : Routes de référence : les valeurs énumérées des données et leurs explications,
 *       et les analyzers avec leurs sources et consignes.
 */

import { Elysia } from "elysia";
import { listAnalyzers } from "../../judge/analyzers";
import { getVocabulary } from "../../judge/vocabulary";
import { API_PREFIX } from "../../config/constants";
import { CatalogModel } from "./model";

export const catalog = new Elysia({ prefix: API_PREFIX, name: "api.catalog" })
  .get("/vocabulary", () => getVocabulary(), {
    response: CatalogModel.vocabulary,
    detail: {
      tags: ["catalog"],
      summary:
        "Valeurs énumérées des données, légendes de taint et définitions des classes, par langue.",
    },
  })
  .get("/analyzers", () => listAnalyzers(), {
    response: CatalogModel.analyzers,
    detail: {
      tags: ["catalog"],
      summary:
        "Analyzers jugés : classes, références lues et consigne de jugement par langue.",
    },
  });
