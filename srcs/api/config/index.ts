/**
 * @author [A likely boring stuff made by] Shevek
 * @desc config/index.ts — Routes de la configuration : lire l'objet `config`, le remplacer. Le changement vit
 *       en mémoire, le temps du service.
 */

import { Elysia } from "elysia";
import { config, setConfig } from "../../config/config";
import { CommonModel } from "../common/model";
import { API_PREFIX } from "../constants";
import { ConfigModel } from "./model";

function view() {
  return {
    analyze: config.analyze,
    classes: config.classes,
    batch: config.batch,
  };
}

export const configuration = new Elysia({
  prefix: API_PREFIX,
  name: "api.config",
})
  .get("/config", view, {
    response: ConfigModel.view,
    detail: {
      tags: ["config"],
      summary: "La configuration en vigueur : dossier, classes, lot.",
    },
  })
  .put(
    "/config",
    ({ body, status }) => {
      try {
        setConfig(body);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return status(400, { error: message });
      }
      return view();
    },
    {
      body: ConfigModel.body,
      response: { 200: ConfigModel.view, 400: CommonModel.error },
      detail: {
        tags: ["config"],
        summary:
          "Remplace la configuration, avec les vérifications des arguments de la ligne de commande.",
        description:
          "Écrit en mémoire : elle ne survit pas à l'arrêt du service, et la ligne de commande la reprend à chaque lancement.",
      },
    },
  );
