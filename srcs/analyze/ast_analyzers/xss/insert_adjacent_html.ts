/**
 * @author [A likely boring stuff made by] Shevek
 * @desc insert_adjacent_html.ts — Appels `el.insertAdjacentHTML(position, html)` : le second argument est
 *       interprété comme du HTML. Le premier (`beforebegin`…) n'est qu'une position.
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

export const INSERT_ADJACENT_HTML_ANALYZER_NAME = "insert-adjacent-html";

const HTML_ARGUMENT_INDEX = 1;

export function isInsertAdjacentHTMLCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  return (
    (t.isIdentifier(node.callee.property, { name: "insertAdjacentHTML" }) &&
      !node.callee.computed) ||
    t.isStringLiteral(node.callee.property, { value: "insertAdjacentHTML" })
  );
}

const insertAdjacentHTMLAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (
      !isInsertAdjacentHTMLCall(node) ||
      node.arguments.length <= HTML_ARGUMENT_INDEX
    )
      return;

    const argument = path.get("arguments")[HTML_ARGUMENT_INDEX]!;
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
      analyzerName: INSERT_ADJACENT_HTML_ANALYZER_NAME,
      slot: { kind: "call-argument", index: HTML_ARGUMENT_INDEX },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: INSERT_ADJACENT_HTML_ANALYZER_NAME,
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

export { insertAdjacentHTMLAnalyzerBuilder };
