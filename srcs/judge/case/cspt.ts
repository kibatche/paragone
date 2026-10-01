/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/cspt.ts — Lignes du dossier propres à CSPT : méthode, session portée par la requête,
 *       position de chaque trou (chemin ou query) et suffixe imposé.
 */

import type { LeadRequest } from "../../analyze/constants/lead";
import type { TaintSinkHole } from "../../analyze/constants/taint_constants";
import { CREDENTIAL_KEYS, type JudgeRequest } from "../constants";
import type { CsptLines } from "../wording/types";

/** @brief L'option du client qui atteste une requête authentifiée, ou undefined. */
function findCredentialEvidence(
  request: LeadRequest | undefined,
): string | undefined {
  if (!request) return undefined;
  for (const [key, value] of Object.entries(request.options)) {
    const bare = (key.split(" ")[0] ?? key).toLowerCase();
    if (CREDENTIAL_KEYS.includes(bare)) return `${bare} = ${value}`;
  }
  return undefined;
}

/**
 * @brief Extension imposée par la fin du chemin, ou undefined.
 *
 * Les trous sont numérotés `EXPR#0` : leur `#` n'est pas un fragment d'URL. Ils sont dénumérotés
 * avant de chercher la frontière, sinon `/a/EXPR#0.png` se coupe au premier trou et perd son extension.
 */
export function findForcedSuffix(pattern: string): string | undefined {
  const pathPart = pattern.replace(/EXPR#\d+/g, "EXPR").split(/[?#]/)[0] ?? "";
  const lastSegment = pathPart.slice(pathPart.lastIndexOf("/") + 1);
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const extension = lastSegment.slice(dot);
  if (extension.includes("EXPR")) return undefined;
  return extension;
}

function describeHole(hole: TaintSinkHole, lines: CsptLines): string {
  return hole.inQuery
    ? lines.holeInQuery(hole.name)
    : lines.holeInPath(hole.name);
}

/** @brief Lignes CSPT du dossier. */
export function csptLines(request: JudgeRequest, lines: CsptLines): string[] {
  const out: string[] = [];
  const clientRequest = request.lead.request;
  if (clientRequest) {
    out.push(
      clientRequest.method === "UNKNOWN_METHOD"
        ? lines.methodUnknown
        : lines.method(clientRequest.method),
    );
  }
  const credentials = findCredentialEvidence(clientRequest);
  out.push(
    credentials ? lines.authenticated(credentials) : lines.notAuthenticated,
  );

  const sink = request.lead.taint?.sink;
  if (!sink?.pattern) return out;
  for (const hole of sink.holes) out.push(describeHole(hole, lines));
  const suffix = findForcedSuffix(sink.pattern);
  if (suffix) out.push(lines.forcedSuffix(suffix));
  return out;
}
