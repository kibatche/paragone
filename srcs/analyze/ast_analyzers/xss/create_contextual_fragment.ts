/**
 * @author [A likely boring stuff made by] Shevek
 * @desc create_contextual_fragment.ts — Appels `range.createContextualFragment(html)` : la chaîne est
 *       analysée comme du HTML, et ses `<script>` s'exécutent quand le fragment est inséré.
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

export const CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME =
  "create-contextual-fragment";

export function isCreateContextualFragmentCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return false;
  return (
    (t.isIdentifier(node.callee.property, {
      name: "createContextualFragment",
    }) &&
      !node.callee.computed) ||
    t.isStringLiteral(node.callee.property, {
      value: "createContextualFragment",
    })
  );
}

const createContextualFragmentAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    if (!isCreateContextualFragmentCall(node) || node.arguments.length < 1)
      return;

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
      analyzerName: CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME,
      slot: { kind: "call-argument", index: 0 },
      reconstructed: reconstructed,
      taint: taint,
    });
    const match: AnalyzerMatch = {
      filePath: args.filePath,
      analyzerName: CREATE_CONTEXTUAL_FRAGMENT_ANALYZER_NAME,
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

export { createContextualFragmentAnalyzerBuilder };
