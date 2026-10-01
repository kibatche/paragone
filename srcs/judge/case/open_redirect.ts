/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/open_redirect.ts — Lignes du dossier propres à OPEN_REDIRECT : le type de navigation, et
 *       ce que le préfixe fixe de la destination laisse à la valeur (schéma, hôte ou chemin seul).
 */

import { LOCATION_ANALYZER_NAME } from "../../analyze/ast_analyzers/open_redirect/location";
import { WINDOW_OPEN_ANALYZER_NAME } from "../../analyze/ast_analyzers/open_redirect/window_open";
import { SPA_NAVIGATION_ANALYZER_NAME } from "../../analyze/ast_analyzers/open_redirect/spa_navigation";
import { PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME } from "../../analyze/ast_analyzers/cspt/path_attribute_assignment";
import {
  ABSOLUTE_URL_PREFIX,
  ABSOLUTE_URL_PREFIX_WITH_HOST,
  type JudgeRequest,
} from "../constants";
import type { OpenRedirectLines } from "../wording/types";

/** @brief Vrai si le préfixe fixe l'hôte : chemin relatif, ou URL absolue dont l'hôte est complet. */
function isHostFixed(prefix: string): boolean {
  if (!ABSOLUTE_URL_PREFIX.test(prefix)) return true;
  return ABSOLUTE_URL_PREFIX_WITH_HOST.test(prefix);
}

/**
 * @brief Ce que la valeur contrôle dans la destination, lu dans le motif reconstruit.
 * @return La ligne à afficher, ou undefined si le motif n'a aucun trou.
 */
export function describeDestination(
  pattern: string,
  lines: OpenRedirectLines,
): string | undefined {
  const firstHole = pattern.search(/EXPR#\d+/);
  if (firstHole === -1) return undefined;
  const prefix = pattern.slice(0, firstHole);
  if (prefix === "") return lines.destinationStartsWithValue;
  if (prefix === "/") return lines.destinationRootOnly;
  if (isHostFixed(prefix)) return lines.destinationFixedHost(prefix);
  return lines.destinationOpenHost(prefix);
}

/** @brief Le type de navigation, déduit de l'analyzer et de l'emplacement de la valeur. */
function describeNavigation(
  request: JudgeRequest,
  lines: OpenRedirectLines,
): string | undefined {
  const { analyzerName, slot } = request.lead;
  if (analyzerName === LOCATION_ANALYZER_NAME) return lines.locationAssignment;
  if (analyzerName === WINDOW_OPEN_ANALYZER_NAME) {
    const index = slot?.index ?? 0;
    return index === 0
      ? lines.windowOpenUrl
      : lines.windowOpenOtherArgument(index);
  }
  if (analyzerName === PATH_ATTRIBUTE_ASSIGNMENT_ANALYZER_NAME)
    return lines.pathAttributeAssignment;
  if (analyzerName === SPA_NAVIGATION_ANALYZER_NAME) return lines.spaNavigation;
  if (slot?.kind === "object-property" && slot.key)
    return lines.objectProperty(slot.key);
  return undefined;
}

/** @brief Lignes OPEN_REDIRECT du dossier. */
export function openRedirectLines(
  request: JudgeRequest,
  lines: OpenRedirectLines,
): string[] {
  const out: string[] = [];
  const navigation = describeNavigation(request, lines);
  if (navigation) out.push(navigation);
  const pattern = request.lead.taint?.sink?.pattern;
  const destination = pattern ? describeDestination(pattern, lines) : undefined;
  if (destination) out.push(destination);
  return out;
}
