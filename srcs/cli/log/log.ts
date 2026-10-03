/**
 * @author [A likely boring stuff made by] kbtch_ + PAI
 * @desc log.ts — Utilitaires pour les logs
 */
import { appendFileSync } from "node:fs";
import { LOG_TXT, LOG_JSONL } from "../../config/constants";

/** Identifiant du process courant : relie entre eux tous les événements d'un même lancement. */
export const RUN_ID = `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * @brief Écrit une ligne humaine sur stdout ET dans log.txt.
 * @param msg Message déjà formaté.
 */
export function log(msg: string): void {
  console.log(msg);
  // append synchrone
  appendFileSync(LOG_TXT, `${new Date().toISOString()} ${msg}\n`);
}

/**
 * @brief Journalise un événement structuré (une ligne JSON) dans events.jsonl.
 * @param event Type d'événement (scan, batch, drop, usage, error…).
 * @param data Charge utile — y mettre les rowids, c'est ce qui rend un hit traçable.
 */
export function logEvent(event: string, data: Record<string, unknown>): void {
  appendFileSync(
    LOG_JSONL,
    JSON.stringify({
      ts: new Date().toISOString(),
      run: RUN_ID,
      event,
      ...data,
    }) + "\n",
  );
}
