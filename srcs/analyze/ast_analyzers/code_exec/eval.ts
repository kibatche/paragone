import { type AnalyzerMatch, type AnalyzerParams } from "../../constants/types";
import { NodePath, type Visitor } from "@babel/traverse";
import * as t from "@babel/types";
import { processStringConcatenation } from "../cspt/cspt_utils";
import {
  getTaintTable,
  taintIdentifier,
} from "../../taint/set_identifier_value";
import {
  buildSinkContext,
  taintReport,
  normalizeNode,
} from "../../taint/taint_report";
import { LEAD_SCHEMA_VERSION, type Lead } from "../../constants/lead";
import { SHA256 } from "bun";
import { randomBytes } from "crypto";

export const EVAL_ANALYZER_NAME = "eval";

function isEvalCall(node: t.CallExpression | t.OptionalCallExpression) {
  return (
    ((t.isMemberExpression(node.callee) ||
      t.isOptionalMemberExpression(node.callee)) &&
      ((t.isIdentifier(node.callee.property, { name: "eval" }) &&
        !node.callee.computed) ||
        t.isStringLiteral(node.callee.property, { value: "eval" }))) ||
    t.isIdentifier(node.callee, { name: "eval" }) ||
    (t.isSequenceExpression(node.callee) &&
      t.isIdentifier(node.callee.expressions.at(-1), { name: "eval" }))
  );
}

const evalAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<t.CallExpression | t.OptionalCallExpression>,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isEvalCall(node) && node.arguments.length >= 1) {
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
          class: ["CODE_EXEC"],
          hash: hash,
          analyzerName: EVAL_ANALYZER_NAME,
          slot: { kind: "call-argument", index: index },
          reconstructed: reconstructed,
          taint: taint,
        });
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: EVAL_ANALYZER_NAME,
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

export { evalAnalyzerBuilder };
