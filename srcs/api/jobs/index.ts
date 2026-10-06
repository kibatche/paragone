/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jobs/index.ts : Routes qui lancent le scan et le juge avec la configuration en mémoire, et route qui
 *       donne l'état du travail en cours et du dernier terminé.
 */

import { Elysia } from "elysia";
import type { JevClient } from "../../judge/jev/client";
import { getJobs, startJudge, startScan } from "../../jobs/jobs";
import { CommonModel } from "../common/model";
import { refusalOf } from "../common/refusal";
import { API_PREFIX } from "../../config/constants";
import { JobsModel } from "./model";

const started = {
  202: JobsModel.job,
  400: CommonModel.error,
  409: CommonModel.error,
} as const;

/** @param deps.createClient Fabrique du client du juge, appelée à chaque lancement du juge. */
export function jobs(deps: { createClient: () => JevClient }) {
  return new Elysia({ prefix: API_PREFIX, name: "api.jobs" })
    .post(
      "/scan",
      ({ status }) => {
        try {
          return status(202, startScan());
        } catch (error) {
          const refusal = refusalOf(error);
          return status(refusal.code, refusal.body);
        }
      },
      {
        response: started,
        detail: {
          tags: ["jobs"],
          summary:
            "Lance le scan du dossier de la configuration, en arrière-plan.",
          description:
            "Rend le travail créé. Son avancement et son bilan se lisent par `GET /api/jobs`.",
        },
      },
    )
    .post(
      "/judge",
      ({ status }) => {
        try {
          return status(202, startJudge(deps.createClient));
        } catch (error) {
          const refusal = refusalOf(error);
          return status(refusal.code, refusal.body);
        }
      },
      {
        response: started,
        detail: {
          tags: ["jobs"],
          summary:
            "Lance le juge sur les leads sans jugement des classes de la configuration, en arrière-plan.",
          description:
            "Dépense des tokens du juge. La clé du juge est lue comme pour la CLI ; sans elle, la réponse est 400.",
        },
      },
    )
    .get("/jobs", () => getJobs(), {
      response: JobsModel.jobs,
      detail: {
        tags: ["jobs"],
        summary: "Le travail en cours et le dernier terminé.",
      },
    });
}
