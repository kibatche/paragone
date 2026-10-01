/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/web_message.ts — Ligne du dossier propre à WEB_MESSAGE : émission (et quel argument de
 *       postMessage) ou réception (quel gestionnaire).
 */

import { ONHASHCHANGE_ANALYZER_NAME } from "../../analyze/ast_analyzers/web_message/onhashchange";
import { POSTMESSAGE_ANALYZER_NAME } from "../../analyze/ast_analyzers/web_message/postmessage";
import {
  POSTMESSAGE_DATA_INDEX,
  POSTMESSAGE_TARGET_ORIGIN_INDEX,
  type JudgeRequest,
} from "../constants";
import type { WebMessageLines } from "../wording/types";

function describeEmitter(index: number, lines: WebMessageLines): string {
  if (index === POSTMESSAGE_DATA_INDEX) return lines.emitterData;
  if (index === POSTMESSAGE_TARGET_ORIGIN_INDEX)
    return lines.emitterTargetOrigin;
  return lines.emitterOtherArgument(index);
}

/** @brief Lignes WEB_MESSAGE du dossier. */
export function webMessageLines(
  request: JudgeRequest,
  lines: WebMessageLines,
): string[] {
  const { analyzerName, slot } = request.lead;
  if (analyzerName === POSTMESSAGE_ANALYZER_NAME)
    return [describeEmitter(slot?.index ?? POSTMESSAGE_DATA_INDEX, lines)];
  if (analyzerName === ONHASHCHANGE_ANALYZER_NAME)
    return [lines.receiverHashChange];
  return [lines.receiverMessage(analyzerName)];
}
