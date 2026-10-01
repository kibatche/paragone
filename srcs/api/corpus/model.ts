/**
 * @author [A likely boring stuff made by] Shevek
 * @desc corpus/model.ts — Schémas des routes du corpus scanné : fichiers et matches.
 */

import { t } from "elysia";
import { FILE_STATUSES } from "../../db/constants";
import { CommonModel, oneOf } from "../common/model";

export const CorpusModel = {
  filesQuery: t.Object({
    status: t.Optional(oneOf(FILE_STATUSES)),
    q: t.Optional(t.String({ description: "Sous-chaîne du chemin." })),
    limit: t.Optional(CommonModel.limit),
    offset: t.Optional(CommonModel.offset),
  }),
  files: t.Array(
    t.Object({
      id: t.Number(),
      path: t.String(),
      sha256: t.String(),
      status: t.String(),
      error: t.Nullable(t.String()),
      scanned_at: t.Number(),
      matches: t.Number(),
      leads: t.Number(),
    }),
  ),
  matchesQuery: t.Object({
    file_id: t.Optional(t.Numeric()),
    analyzer: t.Optional(t.String()),
    limit: t.Optional(CommonModel.limit),
    offset: t.Optional(CommonModel.offset),
  }),
  matches: t.Array(
    t.Object({
      id: t.Number(),
      file_id: t.Number(),
      file: t.String(),
      analyzer: t.String(),
      value: t.String(),
      start_line: t.Number(),
      start_column: t.Number(),
      end_line: t.Number(),
      end_column: t.Number(),
      leads: t.Number(),
    }),
  ),
  count: t.Object({ total: t.Number() }),
} as const;
