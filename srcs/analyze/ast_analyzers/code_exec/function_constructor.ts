/**
 * @author [A likely boring stuff made by] Shevek
 * @desc function_constructor.ts — `new Function(…)` et `Function(…)` : le dernier argument est compilé comme
 *       corps de fonction, les précédents comme noms de paramètres. Tous sont du code.
 */
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

export const FUNCTION_CONSTRUCTOR_ANALYZER_NAME = "function-constructor";

//Function() | new Function() | window.Function()
export function isFunctionConstructor(
  node: t.CallExpression | t.OptionalCallExpression | t.NewExpression,
): boolean {
  const callee = node.callee;
  return (
    t.isIdentifier(callee, { name: "Function" }) ||
    ((t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
      ((t.isIdentifier(callee.property, { name: "Function" }) &&
        !callee.computed) ||
        t.isStringLiteral(callee.property, { value: "Function" })))
  );
}

const functionConstructorAnalyzerBuilder = (
  args: AnalyzerParams,
  matchesReturn: AnalyzerMatch[],
): Visitor => {
  const handle = (
    path: NodePath<
      t.CallExpression | t.OptionalCallExpression | t.NewExpression
    >,
  ) => {
    const node = path.node;
    if (!node.loc || node.start == null || node.end == null) return;

    if (isFunctionConstructor(node) && node.arguments.length >= 1) {
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
          analyzerName: FUNCTION_CONSTRUCTOR_ANALYZER_NAME,
          slot: { kind: "call-argument", index: index },
          reconstructed: reconstructed,
          taint: taint,
        });
      });
      const match: AnalyzerMatch = {
        filePath: args.filePath,
        analyzerName: FUNCTION_CONSTRUCTOR_ANALYZER_NAME,
        value: args.source.slice(node.start, node.end),
        start: node.loc.start,
        end: node.loc.end,
        leads: leads,
      };

      matchesReturn.push(match);
    }
  };
  return {
    CallExpression: handle,
    OptionalCallExpression: handle,
    NewExpression: handle,
  };
};

export { functionConstructorAnalyzerBuilder };
