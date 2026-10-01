import { DEFAULT_MAX_TURNS } from "./constants";


/** @brief Découpe un tableau en lots de taille n (dernier lot éventuellement plus court). */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** État d'un tour, passé à la décision d'arrêt. */
export interface TurnState {
  remaining: number; // leads restants APRÈS le pass courant
  prevRemaining: number; // leads restants avant ce pass
  turn: number; // numéro du tour qui vient de finir (1-based)
  limit: number;
}

/**
 * @brief Décide si la boucle s'arrête après un pass. PURE.
 * @param s État du tour.
 * @return La raison d'arrêt (chaîne loggable), ou `null` pour continuer.
 *
 * Ordre : boucle désactivée → tout traité → limite atteinte → aucun progrès (des lots
 * systématiquement lâchés ne consomment pas toute la limite).
 */
export function stopReason(s: TurnState): string | null {
  if (s.remaining === 0) return "tous les leads jugés";
  if (s.turn >= s.limit) return `limite de ${DEFAULT_MAX_TURNS} tours atteinte`;
  if (s.remaining >= s.prevRemaining)
    return `aucun progrès (${s.remaining} leads sans jugement)`;
  return null;
}