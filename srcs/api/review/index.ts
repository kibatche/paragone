/**
 * @author [A likely boring stuff made by] Shevek
 * @desc review/index.ts : Routes de la revue humaine : enregistrer ou effacer le verdict d'un lead.
 */

import { Elysia } from "elysia";
import { clearHumanReview, setHumanReview } from "../../db/queue";
import { CommonModel } from "../common/model";
import { API_PREFIX } from "../constants";
import { ReviewModel } from "./model";

const notFound = { error: "lead introuvable" };

export const review = new Elysia({ prefix: API_PREFIX, name: "api.review" })
  .post(
    "/lead/:id/human",
    ({ params, body, status }) =>
      setHumanReview(params.id, body.human_score ?? "", body.human_note ?? "")
        ? { ok: true as const }
        : status(404, notFound),
    {
      params: CommonModel.id,
      body: ReviewModel.body,
      response: { 200: CommonModel.ok, 404: CommonModel.error },
      detail: {
        tags: ["review"],
        summary: "Enregistre ou remplace la revue humaine d'un lead.",
      },
    },
  )
  .delete(
    "/lead/:id/human",
    ({ params, status }) =>
      clearHumanReview(params.id)
        ? { ok: true as const }
        : status(404, notFound),
    {
      params: CommonModel.id,
      response: { 200: CommonModel.ok, 404: CommonModel.error },
      detail: {
        tags: ["review"],
        summary: "Efface la revue humaine d'un lead.",
      },
    },
  );
