/**
 * @desc Constantes liées à l'usage des LLM et leur éventuel coût.
 */

import type { Usage } from "./types";

/** @brief Usage neutre — élément neutre de addUsage(). */
export const ZERO_USAGE: Usage = {
  input: 0,
  cacheRead: 0,
  cacheWrite: 0,
  output: 0,
  total: 0,
  cost: 0,
};

/** Tarif en dollars par million de tokens. L'API ne renvoie pas de coût : il se calcule ici. */
export const JEV_INPUT_USD_PER_MTOK = 0.042;
export const JEV_OUTPUT_USD_PER_MTOK = 0;
