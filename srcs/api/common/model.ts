/**
 * @author [A likely boring stuff made by] Shevek
 * @desc common/model.ts — Schémas partagés par plusieurs routes : valeur parmi une liste, erreur,
 *       confirmation, indicateur de requête et pagination.
 */

import { t } from "elysia";

/** @brief Union de littéraux : une valeur absente reste absente. */
export function oneOf<const T extends readonly [string, ...string[]]>(
  values: T,
  options?: { description?: string },
) {
  return t.Unsafe<T[number]>(
    t.Union(
      values.map((value) => t.Literal(value)),
      options,
    ),
  );
}

export const CommonModel = {
  error: t.Object({ error: t.String() }),
  ok: t.Object({ ok: t.Literal(true) }),
  flag: oneOf(["0", "1"], { description: "`1` pour activer." }),
  limit: t.Numeric({
    description: "Nombre maximal de lignes, de 1 à 1000 (200 par défaut).",
  }),
  offset: t.Numeric({ description: "Nombre de lignes à sauter." }),
  id: t.Object({ id: t.Numeric({ description: "Identifiant du lead." }) }),
} as const;
