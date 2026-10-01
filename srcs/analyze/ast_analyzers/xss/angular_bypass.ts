/**
 * @author [A likely boring stuff made by] Shevek
 * @desc angular_bypass.ts — Appels du modèle de confiance des frameworks Angular :
 *       `sanitizer.bypassSecurityTrustHtml|Script|Style|Url|ResourceUrl(x)` (Angular) et `$sce.trustAs*(…)`
 *       (AngularJS) marquent la valeur sûre, qui échappe alors à la désinfection ; `$sce.parseAs*(…)`
 *       (AngularJS) évalue une expression AngularJS dont le résultat doit déjà être approuvé.
 */
import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { type Lead, LEAD_SCHEMA_VERSION } from "../../constants/lead";
import {
  taintIdentifier,
  getTaintTable,
} from "../../taint/set_identifier_value";
import {
  taintReport,
  buildSinkContext,
  normalizeNode,
} from "../../taint/taint_report";
import { processStringConcatenation } from "../cspt/cspt_utils";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const ANGULAR_BYPASS_ANALYZER_NAME = "angular-bypass";

// Méthodes de DomSanitizer (Angular) et de $sce (AngularJS), un couple trustAs/parseAs par contexte SCE.
const BYPASS_METHODS = [
  "bypassSecurityTrustHtml",
  "bypassSecurityTrustStyle",
  "bypassSecurityTrustScript",
  "bypassSecurityTrustUrl",
  "bypassSecurityTrustResourceUrl",
  "trustAs",
  "trustAsHtml",
  "trustAsCss",
  "trustAsUrl",
  "trustAsResourceUrl",
  "trustAsMediaUrl",
  "trustAsJs",
  "parseAs",
  "parseAsHtml",
  "parseAsCss",
  "parseAsUrl",
  "parseAsResourceUrl",
  "parseAsMediaUrl",
  "parseAsJs",
];

// $sce.trustAs($sce.HTML, x) et $sce.parseAs(type, expr) : le type d'abord, la valeur ensuite.
const ANGULARJS_TYPED_METHODS = ["trustAs", "parseAs"];

/** @return Le rang de la valeur marquée sûre, ou undefined si l'appel n'est pas un contournement. */
export function getBypassedValueIndex(
  node: t.CallExpression | t.OptionalCallExpression,
): number | undefined {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return undefined;
  const property = node.callee.property;
  let method: string | undefined;
  if (t.isIdentifier(property) && !node.callee.computed) method = property.name;
  else if (t.isStringLiteral(property)) method = property.value;
  if (!method) return undefined;

  if (!BYPASS_METHODS.includes(method)) return undefined;

  const valueIndex = ANGULARJS_TYPED_METHODS.includes(method) ? 1 : 0;
  return valueIndex < node.arguments.length ? valueIndex : undefined;
}

const angularBypassAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const valueIndex = getBypassedValueIndex(node);
    if (valueIndex === undefined) return;

    const argument = path.get("arguments")[valueIndex]!;
    const reconstructed = processStringConcatenation(argument.node);
    const rootId = taintIdentifier(argument);
    const taint = taintReport(
      rootId,
      getTaintTable(),
      args.source,
      buildSinkContext(argument, path),
    );
    if (!taint) return;
    const normalizedNode = normalizeNode(
      rootId,
      getTaintTable(),
      buildSinkContext(argument, path),
    );
    const hash = SHA256.hash(
      normalizedNode ?? randomBytes(256).toString(),
      "hex",
    ).toString();
    const leads: Lead[] = [];
    leads.push({
      schemaVersion: LEAD_SCHEMA_VERSION,
      class: ["XSS"],
      hash: hash,
      analyzerName: ANGULAR_BYPASS_ANALYZER_NAME,
      slot: { kind: "call-argument", index: valueIndex },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: ANGULAR_BYPASS_ANALYZER_NAME,
      value: args.source.slice(node.start, node.end),
      start: node.loc.start,
      end: node.loc.end,
      leads: leads,
    };

    matchesReturn.push(match);
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { angularBypassAnalyzerBuilder };
