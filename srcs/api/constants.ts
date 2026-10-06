/**
 * @author [A likely boring stuff made by] Shevek
 * @desc constants.ts : Réglages de l'API : hôtes locaux, préfixe des routes, version du contrat et dossier
 *       de la page factice.
 */

/** Hôtes qui ne sont pas joignables depuis le réseau. */
export const LOOPBACK_HOSTS: readonly string[] = [
  "127.0.0.1",
  "localhost",
  "::1",
];

export const API_PREFIX = "/api";

/** Version du contrat OpenAPI publié. */
export const API_VERSION = "0.1.0";
