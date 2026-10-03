/**
 * @author [A likely boring stuff made by] Shevek
 * @desc case/build.ts — Transforme un lead en dossier texte lisible par le juge : en-tête, verdict du
 *       taint et motif, lignes propres à la classe, origines de la valeur, fenêtre de code. Les
 *       phrases viennent de `wording/` ; ce fichier n'en écrit aucune.
 */

import { readFileSync } from "fs";

import type { ImpactClass } from "../../analyze/constants/lead";
import type {
  TaintFinding,
  TaintReport,
} from "../../analyze/constants/taint_constants";
import {
  CODE_LINE_MAX_CHARS,
  FINDINGS_RENDERED_MAX,
  FUNCTION_WINDOW_LINES,
  FUNCTION_WINDOW_MAX_CHARS,
  type JudgeRequest,
} from "../constants";
import type { CaseWording, Wording } from "../wording/types";
import { codeExecLines } from "./code_exec";
import { csptLines } from "./cspt";
import { openRedirectLines } from "./open_redirect";
import { webMessageLines } from "./web_message";
import { xssLines } from "./xss";

/** Lignes propres à chaque classe, insérées après le motif. */
const CLASS_LINES: Record<
  ImpactClass,
  (request: JudgeRequest, wording: Wording) => string[]
> = {
  CSPT: (request, wording) => csptLines(request, wording.CSPT.lines),
  XSS: (request, wording) => xssLines(request, wording.XSS.lines),
  CODE_EXEC: (request, wording) =>
    codeExecLines(request, wording.CODE_EXEC.lines),
  OPEN_REDIRECT: (request, wording) =>
    openRedirectLines(request, wording.OPEN_REDIRECT.lines),
  WEB_MESSAGE: (request, wording) =>
    webMessageLines(request, wording.WEB_MESSAGE.lines),
};

/** @brief Coupe une chaîne en annonçant la coupe. Aucune troncature n'est silencieuse. */
function cap(text: string, max: number, w: CaseWording): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}${w.cut(text.length)}`;
}

/** @brief Une valeur d'énumération suivie de sa phrase, pour que le modèle n'ait rien à deviner. */
function withLegend(value: string, legend: Record<string, string>): string {
  const sentence = legend[value];
  return sentence ? `${value} — ${sentence}` : value;
}

function renderHeader(request: JudgeRequest, w: CaseWording): string[] {
  const { lead } = request;
  const lines = [
    w.file(request.filePath, request.line),
    w.carrier(lead.taint?.sink?.carrierText ?? w.unknownCarrier),
  ];
  if (lead.slot?.kind === "object-property" && lead.slot.key)
    lines.push(w.slotObjectKey(lead.slot.key));
  else if (lead.slot?.kind === "call-argument")
    lines.push(w.slotCallArgument(lead.slot.index ?? 0));
  else if (lead.slot?.kind === "assignment-expression-right")
    lines.push(w.slotAssignment);
  return lines;
}

function renderTaint(
  request: JudgeRequest,
  cls: ImpactClass,
  wording: Wording,
): string[] {
  const w = wording.case;
  const taint = request.lead.taint;
  if (!taint) return CLASS_LINES[cls](request, wording);
  const lines = [w.taintVerdict(withLegend(taint.verdict, w.verdictLegend))];
  const sink = taint.sink;
  lines.push(sink?.pattern ? w.pattern(sink.pattern) : w.patternUnavailable);
  lines.push(...CLASS_LINES[cls](request, wording));
  if (sink && !sink.holesMapped && sink.holes.length > 1)
    lines.push(w.holesUnmapped);
  return lines;
}

/**
 * @brief Première ligne d'un extrait, bornée. `sourceString` couvre tout le noeud : sur une fonction,
 *        c'est son corps entier, déjà rendu par la fenêtre de contexte.
 */
function firstCodeLine(snippet: string, w: CaseWording): string {
  return cap(snippet.split("\n")[0]?.trim() ?? "", CODE_LINE_MAX_CHARS, w);
}

function readCodeLine(
  codeLines: string[],
  lineNumber: number,
  w: CaseWording,
): string {
  const line = codeLines[lineNumber - 1];
  return line === undefined ? "" : cap(line.trim(), CODE_LINE_MAX_CHARS, w);
}

function renderFinding(
  finding: TaintFinding,
  rank: number,
  codeLines: string[],
  w: CaseWording,
): string[] {
  const holes = finding.holes?.map((hole) => hole.name).join(", ");
  const lines = [
    w.origin(rank, holes, cap(finding.text, CODE_LINE_MAX_CHARS, w)),
  ];
  if (finding.knownSource) lines.push(w.knownSource(finding.knownSource));
  if (finding.sanitizeMethod) lines.push(w.knownSanitizeMethod(finding.sanitizeMethod))
  if (finding.derivedFrom !== undefined) lines.push(w.derivedOrigin);

  const lineNumber = finding.loc.start?.line;
  if (lineNumber) {
    const code =
      firstCodeLine(finding.sourceString, w) ||
      readCodeLine(codeLines, lineNumber, w);
    if (code) lines.push(w.originCode(lineNumber, code));
  }

  if (finding.kind !== "INTERNAL") {
    lines.push(w.chainStop(withLegend(finding.kind, w.endKindLegend)));
    if (finding.endReason) lines.push(w.chainStopDetail(finding.endReason));
  }
  return lines;
}

/** @brief Les origines, sources en tête : l'ordre est celui que `taintReport` a fixé. */
function renderFindings(
  taint: TaintReport,
  codeLines: string[],
  w: CaseWording,
): string[] {
  if (!taint.findings.length) return [w.noOrigins];
  const lines = [w.origins];
  const rendered = taint.findings.slice(0, FINDINGS_RENDERED_MAX);
  rendered.forEach((finding, index) => {
    lines.push("", ...renderFinding(finding, index + 1, codeLines, w));
  });
  const dropped = taint.findings.length - rendered.length;
  if (dropped > 0) lines.push("", w.droppedOrigins(dropped));
  return lines;
}

/**
 * @brief Fenêtre de lignes autour du sink. Une fenêtre plutôt que la fonction englobante : sur un
 *        bundle embelli, la fonction est souvent le module entier.
 */
function renderContext(
  request: JudgeRequest,
  codeLines: string[],
  w: CaseWording,
): string[] {
  if (!codeLines.length) return [w.contextUnavailable(request.filePath)];
  const first = Math.max(1, request.line - FUNCTION_WINDOW_LINES);
  const last = Math.min(codeLines.length, request.line + FUNCTION_WINDOW_LINES);
  const body = codeLines.slice(first - 1, last).join("\n");
  return [w.context(first, last), cap(body, FUNCTION_WINDOW_MAX_CHARS, w)];
}

/** @brief Lignes du fichier analysé, ou aucune s'il a disparu : le dossier le dira. */
function readFileLines(filePath: string): string[] {
  try {
    return readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

/**
 * @brief Dossier complet d'un lead pour une classe, en texte étiqueté.
 *
 * L'ordre est une décision : en-tête, verdict et motif d'abord, origines ensuite, contexte en
 * dernier. Si l'attention du modèle s'épuise, elle s'épuise sur le moins décisif.
 */
export function buildCase(
  request: JudgeRequest,
  cls: ImpactClass,
  wording: Wording,
): string {
  const w = wording.case;
  const codeLines = readFileLines(request.filePath);
  const taint = request.lead.taint;
  const sections = [
    renderHeader(request, w),
    renderTaint(request, cls, wording),
    taint ? renderFindings(taint, codeLines, w) : [],
    renderContext(request, codeLines, w),
  ];
  return sections
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join("\n"))
    .join("\n\n");
}
