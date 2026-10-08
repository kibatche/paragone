/**
 * @author [A likely boring stuff made by] Shevek
 * @desc jev/constants.ts : Constantes du juge Jev (TypeSafe) : le modèle interrogé, la variable
 *       d'environnement portant la clé et le `.env` de repli, et le tarif qui sert à chiffrer un run.
 */

import { fileURLToPath } from "node:url";

/** Modèle System One interrogé. */
export const JEV_MODEL = "jev-latest";

/** Variable d'environnement portant la clé API. */
export const ENV_API_KEY = "JEV_API_KEY";

/** `.env` à la racine du dépôt paragone. Bun ne charge que celui du répertoire courant, qui est le projet analysé. */
export const REPO_ENV_FILE = fileURLToPath(
  new URL("../../../.env", import.meta.url),
);
