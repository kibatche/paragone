/**
 * @author [A likely boring stuff made by] Shevek
 * @desc review/model.ts — Schéma du corps de la revue humaine d'un lead.
 */

import { t } from "elysia";
import { HUMAN_SCORES } from "../../db/constants";
import { oneOf } from "../common/model";

export const ReviewModel = {
  body: t.Object({
    human_score: t.Optional(
      oneOf([...HUMAN_SCORES, ""], {
        description: "Verdict humain ; vide pour une note seule.",
      }),
    ),
    human_note: t.Optional(t.String()),
  }),
} as const;
