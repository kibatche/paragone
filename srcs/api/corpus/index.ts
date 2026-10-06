/**
 * @author [A likely boring stuff made by] Shevek
 * @desc corpus/index.ts : Routes du corpus scanné : les fichiers, et les matches des analyzers.
 */

import { Elysia } from "elysia";
import {
  countFiles,
  countMatches,
  listFiles,
  listMatches,
} from "../../db/scan";
import { API_PREFIX } from "../../config/constants";
import { CorpusModel } from "./model";

export const corpus = new Elysia({ prefix: API_PREFIX, name: "api.corpus" })
  .get("/files", ({ query }) => listFiles(query), {
    query: CorpusModel.filesQuery,
    response: CorpusModel.files,
    detail: { tags: ["corpus"], summary: "Fichiers scannés, par chemin." },
  })
  .get("/files/count", ({ query }) => ({ total: countFiles(query) }), {
    query: CorpusModel.filesQuery,
    response: CorpusModel.count,
    detail: {
      tags: ["corpus"],
      summary: "Nombre de fichiers pour les mêmes filtres.",
    },
  })
  .get(
    "/matches",
    ({ query }) =>
      listMatches({
        fileId: query.file_id,
        analyzer: query.analyzer,
        limit: query.limit,
        offset: query.offset,
      }),
    {
      query: CorpusModel.matchesQuery,
      response: CorpusModel.matches,
      detail: {
        tags: ["corpus"],
        summary: "Matches des analyzers, par fichier puis par position.",
      },
    },
  )
  .get(
    "/matches/count",
    ({ query }) => ({
      total: countMatches({ fileId: query.file_id, analyzer: query.analyzer }),
    }),
    {
      query: CorpusModel.matchesQuery,
      response: CorpusModel.count,
      detail: {
        tags: ["corpus"],
        summary: "Nombre de matches pour les mêmes filtres.",
      },
    },
  );
