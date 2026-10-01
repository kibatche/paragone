/**
 * @author [A likely boring stuff made by] Shevek
 * @desc source/index.ts — Routes du code source d'un lead : son texte, et son ouverture dans l'éditeur
 *       local. Le client n'envoie qu'un identifiant de lead, jamais un chemin.
 */

import { Elysia } from "elysia";
import { getLead } from "../../db/queue";
import { readLeadSource } from "../../paths/source";
import { CommonModel } from "../common/model";
import { API_PREFIX } from "../constants";
import { openInEditor } from "../utils/editor";
import { SourceModel } from "./model";

const notFound = { error: "lead introuvable" };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const source = new Elysia({ prefix: API_PREFIX, name: "api.source" })
  .get(
    "/source",
    async ({ query, status }) => {
      try {
        return (await readLeadSource(query.id)) ?? status(404, notFound);
      } catch (error) {
        return status(404, { error: messageOf(error) });
      }
    },
    {
      query: SourceModel.query,
      response: { 200: SourceModel.source, 404: CommonModel.error },
      detail: {
        tags: ["source"],
        summary: "Le fichier source entier du lead et la ligne de son match.",
      },
    },
  )
  .post(
    "/lead/:id/open",
    async ({ params, request, status }) => {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return status(415, { error: "Content-Type application/json requis" });
      const lead = getLead(params.id);
      if (!lead) return status(404, notFound);
      try {
        await openInEditor(lead.file, lead.line, lead.column);
        return { ok: true as const };
      } catch (error) {
        console.error(error);
        return status(500, { error: messageOf(error) });
      }
    },
    {
      params: CommonModel.id,
      response: {
        200: CommonModel.ok,
        404: CommonModel.error,
        415: CommonModel.error,
        500: CommonModel.error,
      },
      detail: {
        tags: ["source"],
        summary: "Ouvre le fichier du lead dans l'éditeur local, à sa ligne.",
        description:
          "Le `Content-Type: application/json` est exigé : il écarte un envoi de formulaire fait par une autre page.",
      },
    },
  );
