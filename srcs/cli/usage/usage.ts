/**
 * @author [A likely boring stuff made by] kbtch_ + Shevek
 * @desc usage.ts — Usage des LLM : cumul lot par lot, lecture humaine, et usage d'un verdict. La base est
 *       écrite lot par lot par `saveBatchUsage` de db/usage.ts.
 */

import type { JevVerdict } from "../../judge/jev/verdict";
import { JEV_INPUT_USD_PER_MTOK, JEV_OUTPUT_USD_PER_MTOK } from "./constants";
import type { Usage } from "./types";

/** @brief Somme deux usages (accumulation lot par lot). */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    output: a.output + b.output,
    total: a.total + b.total,
    cost: a.cost + b.cost,
  };
}

/** @brief Rend l'usage lisible en une ligne (log humain). */
export function formatUsage(u: Usage): string {
  return `${u.total} tok (frais in=${u.input} out=${u.output} | cache r=${u.cacheRead} w=${u.cacheWrite}) — $${u.cost.toFixed(4)}`;
}

/** @brief Tokens et coût d'un verdict. Jev n'a pas de cache : ces deux compteurs restent à zéro. */
export function usageOf(verdict: JevVerdict): Usage {
  const cost =
    (verdict.inputTokens * JEV_INPUT_USD_PER_MTOK +
      verdict.outputTokens * JEV_OUTPUT_USD_PER_MTOK) /
    1_000_000;
  return {
    input: verdict.inputTokens,
    cacheRead: 0,
    cacheWrite: 0,
    output: verdict.outputTokens,
    total: verdict.inputTokens + verdict.outputTokens,
    cost,
  };
}
