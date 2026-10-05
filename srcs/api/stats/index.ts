/**
 * @author [A likely boring stuff made by] Shevek
 * @desc stats/index.ts : Routes `/api/summary` et `/api/tokens` : compteurs de la base et usage du juge.
 */

import { Elysia } from "elysia";
import { summary } from "../../db/queue";
import { getUsage } from "../../db/usage";
import { API_PREFIX } from "../constants";
import { StatsModel } from "./model";

export const stats = new Elysia({ prefix: API_PREFIX, name: "api.stats" })
  .get("/summary", () => summary(), {
    response: StatsModel.summary,
    detail: {
      tags: ["stats"],
      summary:
        "Compteurs et répartitions par classe, verdict, score, statut de fichier, analyzer.",
    },
  })
  .get("/tokens", () => getUsage(), {
    response: StatsModel.usage,
    detail: {
      tags: ["stats"],
      summary:
        "Tokens et coût du juge : global, par lancement, par classe, par phase.",
    },
  });
