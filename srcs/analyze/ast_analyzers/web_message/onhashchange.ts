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

export const ONHASHCHANGE_ANALYZER_NAME = "onhashchange";

export function isAddEventListenerWithHashchange(
  node: t.CallExpression | t.OptionalCallExpression,
  args: (t.ArgumentPlaceholder | t.SpreadElement | t.Expression)[],
): boolean {
  return (
    args.length > 1 &&
    t.isStringLiteral(args[0], { value: "hashchange" }) &&
    (((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property, { name: "addEventListener" }) &&
        !node.callee.computed) ||
        t.isStringLiteral(node.callee.property, {
          value: "addEventListener",
        }))) ||
      ((t.isCallExpression(node) || t.isOptionalCallExpression(node)) &&
        t.isIdentifier(node.callee, { name: "addEventListener" })))
  );
}

const onhashchangeAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleAssignment = (path: NodePath<t.AssignmentExpression>) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;
    const left = node.left;

    //cas où on a juste "onhashchange = truc", on doit return directement.
    // sinon le test suivant sur la présence d'un memberExpression invalide cette écriture pourtant valide.
    const isOnlyOnhashchangeAssignment = t.isIdentifier(left, {
      name: "onhashchange",
    });
    if (isOnlyOnhashchangeAssignment) {
      const reconstructed = processStringConcatenation(path.get("right").node);
      const rootId = taintIdentifier(path.get("right"));
      const taint = taintReport(
        rootId,
        getTaintTable(),
        args.source,
        buildSinkContext(path.get("right"), path),
      );
      if (!taint) return;
      const normalizedNode = normalizeNode(
        rootId,
        getTaintTable(),
        buildSinkContext(path.get("right"), path),
      );
      const hash = SHA256.hash(
        normalizedNode ?? randomBytes(256).toString(),
        "hex",
      ).toString();
      const leads: Lead[] = [];
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["WEB_MESSAGE"],
        hash: hash,
        analyzerName: ONHASHCHANGE_ANALYZER_NAME,
        slot: { kind: "assignment-expression-right" },
        reconstructed: reconstructed,
        taint: taint,
      });
      matchesReturn.push({
        filePath: args.filePath,
        analyzerName: ONHASHCHANGE_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      });
      return;
    }
    if (!t.isMemberExpression(left) && !t.isOptionalMemberExpression(left))
      return;
    const isOnhashchangeAssignment =
      (t.isIdentifier(left.property, { name: "onhashchange" }) &&
        !left.computed) || // cas où whatever.onhashchange = truc ou whatever.whatever.onhashchange = truc
      t.isStringLiteral(left.property, { value: "onhashchange" }); // cas où whatever['onhashchange'] = truc

    // Check if this is an onhashchange assignment
    if (isOnhashchangeAssignment) {
      const reconstructed = processStringConcatenation(path.get("right").node);
      const rootId = taintIdentifier(path.get("right"));
      const taint = taintReport(
        rootId,
        getTaintTable(),
        args.source,
        buildSinkContext(path.get("right"), path),
      );
      if (!taint) return;
      const normalizedNode = normalizeNode(
        rootId,
        getTaintTable(),
        buildSinkContext(path.get("right"), path),
      );
      const hash = SHA256.hash(
        normalizedNode ?? randomBytes(256).toString(),
        "hex",
      ).toString();
      const leads: Lead[] = [];
      leads.push({
        schemaVersion: LEAD_SCHEMA_VERSION,
        class: ["WEB_MESSAGE"],
        hash: hash,
        analyzerName: ONHASHCHANGE_ANALYZER_NAME,
        slot: { kind: "assignment-expression-right" },
        reconstructed: reconstructed,
        taint: taint,
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: ONHASHCHANGE_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    // Check if this is an addEventListener call with "hashchange" event
    if (isAddEventListenerWithHashchange(node, node.arguments)) {
      const leads: Lead[] = [];
      path.get("arguments").forEach((argument, index) => {
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
        leads.push({
          schemaVersion: LEAD_SCHEMA_VERSION,
          class: ["WEB_MESSAGE"],
          hash: hash,
          analyzerName: ONHASHCHANGE_ANALYZER_NAME,
          slot: { kind: "call-argument", index: index },
          reconstructed: reconstructed,
          taint: taint,
        });
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: ONHASHCHANGE_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  return {
    AssignmentExpression: handleAssignment,
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { onhashchangeAnalyzerBuilder };
