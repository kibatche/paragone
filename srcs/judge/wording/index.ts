/**
 * @author [A likely boring stuff made by] Shevek
 * @desc wording/index.ts — Point d'entrée des textes du juge : une langue donne un `Wording` complet.
 */

import { JUDGE_LANGUAGES, type JudgeLanguage } from "../constants";
import { EN } from "./en";
import { FR } from "./fr";
import type { Wording } from "./types";

const WORDINGS: Record<JudgeLanguage, Wording> = { fr: FR, en: EN };

/** @brief Vrai si la chaîne désigne une langue dans laquelle le juge est rédigé. */
export function isJudgeLanguage(value: unknown): value is JudgeLanguage {
  return (JUDGE_LANGUAGES as readonly unknown[]).includes(value);
}

/** @brief Tous les textes du juge dans une langue. */
export function wordingFor(language: JudgeLanguage): Wording {
  return WORDINGS[language];
}
