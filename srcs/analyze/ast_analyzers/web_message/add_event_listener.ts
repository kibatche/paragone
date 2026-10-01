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
import { processStringConcatenation, isValidPath } from "../cspt/cspt_utils";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const ADD_EVENT_LISTENER_ANALYZER_NAME = "add-event-listener";

export function isAddEventListenerCall(
  node: t.CallExpression | t.OptionalCallExpression,
): boolean {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property, { name: "addEventListener" }) &&
        !node.callee.computed) ||
        t.isStringLiteral(node.callee.property, {
          value: "addEventListener",
        }))) ||
    t.isIdentifier(node.callee, { name: "addEventListener" })
  );
}

/**
 * @description
 * Teste si un noeud est un addEventListener.
 * Prend en charge:
 *   el.addEventListener
 *   el?.addEventListener
 *   addEventListener
 *   el?.["addEventListener"]("b", f)
 *   el["addEventListener"]("b", f)
 * @param args Les arguments de type AnalyzerParams (ast, source, filePath)
 * @param matchesReturn Le tableau de matches.
 * @returns
 */
const addEventListenerAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    const leads: Lead[] = [];
    path.get("arguments").forEach((argument, index) => {
      const reconstructed = processStringConcatenation(argument.node);
      if (!isValidPath(reconstructed)) return;

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
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["WEB_MESSAGE"],
        hash: hash,
        analyzerName: ADD_EVENT_LISTENER_ANALYZER_NAME,
        slot: { kind: "call-argument", index: index },
        reconstructed: reconstructed,
        taint: taint,
      });
    });
    if (isAddEventListenerCall(node) && node.arguments.length >= 2) {
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: ADD_EVENT_LISTENER_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  return { CallExpression: handle, OptionalCallExpression: handle };
};

export { addEventListenerAnalyzerBuilder };
