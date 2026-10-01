/**
 * @desc Type(s) lié(s) à l'usage d'un LLM.
 */

export type Usage = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  total: number;
  cost: number;
};
