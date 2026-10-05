/**
 * @author [A likely boring stuff made by] Shevek
 * @desc leads/index.ts : Routes de la file de triage : la file filtrée, son effectif, le détail d'un lead,
 *       son dossier de jugement et ses doublons.
 */

import { Elysia } from "elysia";
import { QUEUE_MASKS } from "../../db/constants";
import { countQueue, getLead, listDuplicates, listLeads } from "../../db/queue";
import type { ListFilters } from "../../db/types";
import { DEFAULT_JUDGE_LANGUAGE } from "../../judge/constants";
import { buildLeadDossier } from "../../judge/dossier";
import { CommonModel } from "../common/model";
import { API_PREFIX } from "../constants";
import { LeadsModel } from "./model";

type Query = typeof LeadsModel.queue.static;

function toFilters(query: Query): ListFilters {
  const filters: ListFilters = {
    cls: query.class,
    kind: query.kind,
    verdict: query.verdict,
    score: query.score,
    analyzer: query.analyzer,
    humanScore: query.human,
    unjudged: query.unjudged === "1",
    q: query.q,
    limit: query.limit,
    offset: query.offset,
  };
  for (const mask of QUEUE_MASKS) filters[mask] = query[mask] === "1";
  return filters;
}

const notFound = { error: "lead introuvable" };

export const leads = new Elysia({ prefix: API_PREFIX, name: "api.leads" })
  .get("/leads", ({ query }) => listLeads(toFilters(query)), {
    query: LeadsModel.queue,
    response: LeadsModel.rows,
    detail: {
      tags: ["leads"],
      summary: "La file de triage : leads les plus prometteurs en tête.",
      description:
        "Par défaut, la file masque l'inventaire, les doublons, les leads entièrement littéraux, les rejetés et les déjà revus ; chaque `show*=1` lève un masque.",
    },
  })
  .get("/leads/count", ({ query }) => countQueue(toFilters(query)), {
    query: LeadsModel.queue,
    response: LeadsModel.count,
    detail: {
      tags: ["leads"],
      summary:
        "Taille de la file et, par masque posé, combien de leads il cache en plus.",
    },
  })
  .get(
    "/lead/:id",
    ({ params, status }) => getLead(params.id) ?? status(404, notFound),
    {
      params: CommonModel.id,
      response: { 200: LeadsModel.detail, 404: CommonModel.error },
      detail: {
        tags: ["leads"],
        summary: "Un lead, avec ses jugements et son rapport de taint.",
      },
    },
  )
  .get(
    "/lead/:id/dossier",
    ({ params, query, status }) => {
      const lead = getLead(params.id);
      if (!lead) return status(404, notFound);
      return buildLeadDossier(lead, query.lang ?? DEFAULT_JUDGE_LANGUAGE);
    },
    {
      params: CommonModel.id,
      query: LeadsModel.dossierQuery,
      response: { 200: LeadsModel.dossier, 404: CommonModel.error },
      detail: {
        tags: ["leads"],
        summary:
          "Cadre de jugement du lead : définitions, consignes, références et texte envoyé à Jev.",
      },
    },
  )
  .get("/lead/:id/duplicates", ({ params }) => listDuplicates(params.id), {
    params: CommonModel.id,
    response: LeadsModel.rows,
    detail: {
      tags: ["leads"],
      summary: "Les leads qui en dupliquent un autre.",
    },
  });
