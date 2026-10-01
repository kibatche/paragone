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

export const WINDOW_OPEN_ANALYZER_NAME = "window-open";

export function isWindowOpenCallExpression(
  node: t.CallExpression | t.OptionalCallExpression,
) {
  if (
    !t.isMemberExpression(node.callee) &&
    !t.isOptionalMemberExpression(node.callee)
  )
    return;

  //window|self|top|parent|globalThis.open()
  //window|self|top|parent|globalThis['open']()
  const isSimpleOpenCallExpression =
    (t.isIdentifier(node.callee.object, { name: "window" }) ||
      t.isIdentifier(node.callee.object, { name: "self" }) ||
      t.isIdentifier(node.callee.object, { name: "top" }) ||
      t.isIdentifier(node.callee.object, { name: "parent" }) ||
      t.isIdentifier(node.callee.object, { name: "globalThis" })) &&
    ((t.isIdentifier(node.callee.property, { name: "open" }) &&
      !node.callee.computed) ||
      t.isStringLiteral(node.callee.property, { value: "open" }));

  const obj = node.callee.object;

  //whatever.window|self|top|parent|globalThis.open()
  //whatever['window|self|top|parent|globalThis'].open()
  //whatever.window|self|top|parent|globalThis['open']()
  //whatever['window|self|top|parent|globalThis']['open']()
  const isComplexOpenCallExpression =
    (t.isMemberExpression(obj) || t.isOptionalMemberExpression(obj)) &&
    t.isIdentifier(obj.object) && // whatever.self par exemple
    ((t.isIdentifier(obj.property, { name: "window" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "window" }) ||
      (t.isIdentifier(obj.property, { name: "self" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "self" }) ||
      (t.isIdentifier(obj.property, { name: "top" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "top" }) ||
      (t.isIdentifier(obj.property, { name: "parent" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "parent" }) ||
      (t.isIdentifier(obj.property, { name: "globalThis" }) && !obj.computed) ||
      t.isStringLiteral(obj.property, { value: "globalThis" })) &&
    ((t.isIdentifier(node.callee.property, { name: "open" }) &&
      !node.callee.computed) ||
      t.isStringLiteral(node.callee.property, { value: "open" }));

  return isSimpleOpenCallExpression || isComplexOpenCallExpression;
}

const windowOpenAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handleCallExpression = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isWindowOpenCallExpression(node)) {
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
          class: ["OPEN_REDIRECT"],
          hash: hash,
          analyzerName: WINDOW_OPEN_ANALYZER_NAME,
          slot: { kind: "call-argument", index: index },
          reconstructed: reconstructed,
          taint: taint,
        });
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: WINDOW_OPEN_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  return {
    CallExpression: handleCallExpression,
    OptionalCallExpression: handleCallExpression,
  };
};

export { windowOpenAnalyzerBuilder };
