/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jev/client.ts — Accès à l'API Jev (TypeSafe System One) : lecture de la clé, création du
 *       client, et tri des erreurs qui doivent arrêter un run.
 */

import { existsSync, readFileSync } from "node:fs";

import {
  AuthenticationError,
  BadRequestError,
  NotFoundError,
  PermissionDeniedError,
  TypeSafeClient,
  UnprocessableEntityError,
} from "@typesafe-ai/sdk";

import { ENV_API_KEY, REPO_ENV_FILE } from "./constants";

/** Ce que le juge utilise du client : un faux client de test n'a qu'à fournir `systemOne`. */
export type JevClient = Pick<TypeSafeClient, "systemOne">;

/** @brief Valeur de `name` dans un fichier `.env`, ou undefined si le fichier ou la ligne manque. */
export function readEnvFile(path: string, name: string): string | undefined {
  if (!existsSync(path)) return undefined;
  const line = readFileSync(path, "utf8")
    .split("\n")
    .find((l) => l.trimStart().startsWith(`${name}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^(["'])(.*)\1$/, "$2") || undefined;
}

/**
 * @brief Le client Jev. La clé vient de l'environnement, sinon du `.env` du dépôt. Lève si elle
 *        n'est dans aucun des deux.
 */
export function createJevClient(): TypeSafeClient {
  const apiKey =
    process.env[ENV_API_KEY] ?? readEnvFile(REPO_ENV_FILE, ENV_API_KEY);
  if (!apiKey) {
    throw new Error(
      `Error [jev]: ${ENV_API_KEY} absente de l'environnement et de ${REPO_ENV_FILE}.`,
    );
  }
  return new TypeSafeClient({ apiKey });
}

/**
 * @brief Vrai pour une erreur qui se reproduira à l'identique sur chaque lead (clé, droits, requête
 *        mal formée). Les erreurs réseau, 429 et 5xx sont déjà réessayées par le SDK.
 */
export function isPermanentJevError(err: unknown): boolean {
  return (
    err instanceof AuthenticationError ||
    err instanceof PermissionDeniedError ||
    err instanceof BadRequestError ||
    err instanceof NotFoundError ||
    err instanceof UnprocessableEntityError
  );
}
