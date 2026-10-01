/**
 * @author [A likely boring stuff made by] Shevek
 * @desc leads/model.ts — Schémas des routes de la file de triage : filtres, lignes de file, détail d'un
 *       lead et dossier de jugement.
 */

import { t } from "elysia";
import { TAINT_VERDICTS } from "../../analyze/constants/taint_constants";
import {
  IMPACT_CLASSES,
  INVENTORY_CLASSES,
  LEAD_KINDS,
} from "../../analyze/constants/lead";
import { HUMAN_SCORES } from "../../db/constants";
import { JUDGE_LANGUAGES, JUDGE_SCORES } from "../../judge/constants";
import { CommonModel, oneOf } from "../common/model";

const flag = t.Optional(CommonModel.flag);
const LEAD_CLASSES = [...IMPACT_CLASSES, ...INVENTORY_CLASSES] as const;

const judgement = t.Object({
  class: t.String(),
  score: t.String(),
  note: t.String(),
  reject_reason: t.Nullable(t.String()),
  confidence: t.Nullable(t.Number()),
  probabilities: t.Nullable(t.Record(t.String(), t.Number())),
  model: t.Nullable(t.String()),
  judged_at: t.Number(),
});

const row = t.Object({
  id: t.Number(),
  duplicate_of: t.Nullable(t.Number()),
  kind: t.String(),
  classes: t.Array(t.String()),
  reconstructed: t.String(),
  verdict: t.Nullable(t.String()),
  analyzer: t.String(),
  analyzer_name: t.String(),
  method: t.Nullable(t.String()),
  carrier: t.Nullable(t.String()),
  file: t.String(),
  line: t.Number(),
  priority: t.Number({
    description: "0 HIGH, 1 MEDIUM, 2 IN_DEPTH, 3 non jugé, 4 REJECT.",
  }),
  expectation: t.Nullable(
    t.Number({ description: "Espérance du grade de Jev ; null si non jugé." }),
  ),
  judgements: t.Array(judgement),
  human_score: t.Nullable(t.String()),
  reviewed_at: t.Nullable(t.Number()),
});

const hidden = t.Object({
  showInventory: t.Optional(t.Number()),
  showDuplicates: t.Optional(t.Number()),
  showLiteral: t.Optional(t.Number()),
  showRejected: t.Optional(t.Number()),
  showReviewed: t.Optional(t.Number()),
});

const lead = t.Object({
  schemaVersion: t.Number(),
  class: t.Array(t.String()),
  analyzerName: t.String(),
  hash: t.String(),
  reconstructed: t.String(),
  slot: t.Optional(t.Any()),
  request: t.Optional(t.Any()),
  taint: t.Optional(t.Any({ description: "Rapport de taint complet." })),
});

const classDossier = t.Object({
  cls: t.String(),
  definition: t.String(),
  guidance: t.Nullable(t.String()),
  scores: t.Record(t.String(), t.String()),
  reasons: t.Record(t.String(), t.String()),
  caseText: t.String({ description: "Le texte envoyé à Jev, tel quel." }),
});

export const LeadsModel = {
  queue: t.Object({
    class: t.Optional(oneOf(LEAD_CLASSES)),
    kind: t.Optional(oneOf(LEAD_KINDS)),
    verdict: t.Optional(oneOf(TAINT_VERDICTS)),
    score: t.Optional(oneOf(JUDGE_SCORES)),
    analyzer: t.Optional(t.String()),
    human: t.Optional(oneOf(HUMAN_SCORES)),
    unjudged: flag,
    q: t.Optional(
      t.String({
        description: "Sous-chaîne du chemin, du match ou du texte reconstruit.",
      }),
    ),
    limit: t.Optional(CommonModel.limit),
    offset: t.Optional(CommonModel.offset),
    showInventory: flag,
    showDuplicates: flag,
    showLiteral: flag,
    showRejected: flag,
    showReviewed: flag,
  }),
  rows: t.Array(row),
  count: t.Object({ total: t.Number(), hidden }),
  detail: t.Object({
    id: t.Number(),
    duplicate_of: t.Nullable(t.Number()),
    kind: t.String(),
    classes: t.Array(t.String()),
    reconstructed: t.String(),
    pattern: t.Nullable(t.String()),
    verdict: t.Nullable(t.String()),
    lead,
    human_score: t.Nullable(t.String()),
    human_note: t.Nullable(t.String()),
    reviewed_at: t.Nullable(t.Number()),
    analyzer: t.String(),
    match_text: t.String(),
    line: t.Number(),
    column: t.Number(),
    file: t.String(),
    judgements: t.Array(judgement),
    duplicates: t.Number(),
  }),
  dossierQuery: t.Object({
    lang: t.Optional(
      oneOf(JUDGE_LANGUAGES, {
        description: "Langue du dossier ; fr par défaut.",
      }),
    ),
  }),
  dossier: t.Object({
    analyzerName: t.String(),
    references: t.Array(t.Object({ label: t.String(), url: t.String() })),
    classes: t.Array(classDossier),
    verdictLegend: t.Nullable(t.String()),
    endKindLegend: t.Record(t.String(), t.String()),
  }),
} as const;
