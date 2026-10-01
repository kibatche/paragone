/**
 * @author [A likely boring stuff made by] Shevek
 * @desc set_html_unsafe.ts — Appels `el.setHTMLUnsafe(html)` et `Document.parseHTMLUnsafe(html)` : analyse
 *       HTML sans désinfection, déclarative shadow DOM comprise.
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

export const SET_HTML_UNSAFE_ANALYZER_NAME = "set-html-unsafe";

const UNSAFE_HTML_METHODS = ["setHTMLUnsafe", "parseHTMLUnsafe"];

export function isUnsafeHTMLMethodCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  return (
    (t.isIdentifier(node.callee.property) &&
      !node.callee.computed &&
      UNSAFE_HTML_METHODS.includes(node.callee.property.name)) ||
    (t.isStringLiteral(node.callee.property) &&
      UNSAFE_HTML_METHODS.includes(node.callee.property.value))
  );
}

const setHTMLUnsafeAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isUnsafeHTMLMethodCall(node) || node.arguments.length < 1) return;

    const argument = path.get("arguments")[0]!;
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
      analyzerName: SET_HTML_UNSAFE_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: SET_HTML_UNSAFE_ANALYZER_NAME,
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

export { setHTMLUnsafeAnalyzerBuilder };
