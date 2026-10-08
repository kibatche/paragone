/**
 * @author [A likely boring stuff made by] Shevek
 * @desc types.ts : Paramètres d'un lancement de l'API.
 */

import type { JevClient } from "../judge/jev/client";

export interface ApiOptions {
  port: number;
  host: string;
  /** Origines autorisées à appeler l'API depuis un autre site ; vide : aucune. */
  cors: string[];
  /** Dossier servi à `/` ; absent : la page factice. */
  publicDir?: string;
  /** Fabrique du client du juge ; absente : celui de Jev. */
  createJudgeClient?: () => JevClient;
}
