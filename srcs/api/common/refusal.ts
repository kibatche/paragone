/**
 * @author [A likely boring stuff made by] Shevek
 * @desc refusal.ts : Traduit le refus de lancer un travail en réponse HTTP : 409 si un travail tourne, 400
 *       si la configuration ne permet pas de lancer. Toute autre erreur remonte.
 */

import { JobRefusal } from "../../jobs/errors";

interface Refusal {
  code: 400 | 409;
  body: { error: string };
}

/** @throws l'erreur reçue si ce n'est pas un `JobRefusal`. */
export function refusalOf(error: unknown): Refusal {
  if (error instanceof JobRefusal)
    return { code: error.code, body: { error: error.message } };
  throw error;
}
