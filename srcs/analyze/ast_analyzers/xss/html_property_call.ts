/**
 * @author [A likely boring stuff made by] Shevek
 * @desc html_property_call.ts — Appels qui affectent une propriété HTML nommée par une chaîne :
 *       `ɵɵproperty("innerHTML", x)` (liaison `[innerHTML]` compilée par Angular), `renderer.setProperty(el,
 *       "innerHTML", x)`, `Reflect.set(el, "innerHTML", x)`. En bundle, `ɵɵproperty` perd son nom ; le
 *       littéral `"innerHTML"` suivi de la valeur, lui, survit.
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

export const HTML_PROPERTY_CALL_ANALYZER_NAME = "html-property-call";

const HTML_PROPERTY_NAMES = ["innerHTML", "outerHTML", "srcdoc"];

/**
 * @return Le rang de la valeur affectée : l'argument qui suit le nom de propriété HTML, ou undefined.
 */
export function getHTMLPropertyValueIndex(
  node: t.CallExpression | t.OptionalCallExpression,
): number | undefined {
  const nameIndex = node.arguments.findIndex(
    (argument) =>
      t.isStringLiteral(argument) &&
      HTML_PROPERTY_NAMES.includes(argument.value),
  );
  if (nameIndex === -1 || nameIndex + 1 >= node.arguments.length)
    return undefined;
  return nameIndex + 1;
}

const htmlPropertyCallAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    const valueIndex = getHTMLPropertyValueIndex(node);
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
      analyzerName: HTML_PROPERTY_CALL_ANALYZER_NAME,
      slot: { kind: "call-argument", index: valueIndex },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: HTML_PROPERTY_CALL_ANALYZER_NAME,
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

export { htmlPropertyCallAnalyzerBuilder };
